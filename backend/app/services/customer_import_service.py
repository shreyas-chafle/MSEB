import io
import csv
from typing import List, Dict, Any, Tuple, Optional

from datetime import datetime, timedelta
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import UploadFile, HTTPException

class CustomerImportService:

    @staticmethod
    def normalize_header(header: str) -> str:
        """Clean and normalize column names for fuzzy header matching."""
        return header.strip().lower().replace('_', ' ').replace('-', ' ')

    @staticmethod
    def get_column_mapping(headers: List[str]) -> Dict[str, int]:
        """
        Maps normalized header titles to row column indices.
        Supports aliases like:
        - customer_id: 'cus id', 'customer id', 'customer_id', 'cus_id'
        - consumer_no/name: 'cons no', 'consumer no', 'consumer_no', 'name', 'phone'
        - meter_id: 'meter id', 'meter_id', 'meter number', 'meter_number', 'meter no'
        - latitude: 'latitude', 'lat', 'lang long' (part 1)
        - longitude: 'longitude', 'long', 'lng', 'lang long' (part 2)
        - pending_amount: 'total deu amt', 'total due amt', 'pending_amount', 'due amount', 'bill_amount'
        """
        mapping = {}
        for idx, raw_h in enumerate(headers):
            h = CustomerImportService.normalize_header(raw_h)

            if any(k in h for k in ['cus id', 'customer id', 'customer_id', 'cus_id', 'cust id']):
                mapping['customer_id'] = idx
            elif any(k in h for k in ['cons no', 'cons_no', 'consumer no', 'consumer_no', 'name', 'consumer name']):
                mapping['name'] = idx
            elif any(k in h for k in ['meter id', 'meter_id', 'meter number', 'meter_number', 'meter no', 'mtr id']):
                mapping['meter_number'] = idx
            elif any(k in h for k in ['total deu amt', 'total_due_amt', 'total due amt', 'pending_amount', 'due amount', 'bill amount', 'pending amount', 'amount']):
                mapping['pending_amount'] = idx
            elif any(k in h for k in ['latitude', 'lat']):
                mapping['latitude'] = idx
            elif any(k in h for k in ['longitude', 'long', 'lng']):
                mapping['longitude'] = idx
            elif any(k in h for k in ['lang long', 'lat long', 'coordinates', 'lat/long']):
                mapping['lang_long'] = idx
            elif any(k in h for k in ['dtc', 'dtc code', 'dtc_code', 'dtc no', 'dtc number', 'transformer', 'dt']):
                mapping['dtc_code'] = idx
            elif 'address' in h:
                mapping['address'] = idx
            elif 'area' in h:
                mapping['area'] = idx

        return mapping

    @staticmethod
    async def parse_file_rows(file: UploadFile) -> Tuple[List[str], List[List[Any]]]:
        """Extract headers and data rows from CSV or XLSX files."""
        content = await file.read()
        filename = (file.filename or '').lower()

        if filename.endswith('.csv'):
            try:
                text_content = content.decode('utf-8-sig', errors='ignore')
            except Exception:
                text_content = content.decode('latin-1', errors='ignore')
            
            stream = io.StringIO(text_content)
            reader = csv.reader(stream)
            rows = [row for row in reader if any(cell.strip() for cell in row)]
            if not rows:
                raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")
            headers = [str(cell) for cell in rows[0]]
            data_rows = rows[1:]
            return headers, data_rows

        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            try:
                import openpyxl
            except ImportError:
                raise HTTPException(status_code=500, detail="openpyxl package is required for Excel files.")

            try:
                workbook = openpyxl.load_workbook(filename=io.BytesIO(content), data_only=True)
            except Exception as e:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to read Excel file. Please ensure it is a valid .xlsx file: {str(e)}"
                )

            sheet = workbook.active
            if sheet is None and workbook.worksheets:
                sheet = workbook.worksheets[0]

            if sheet is None:
                raise HTTPException(status_code=400, detail="Uploaded Excel file contains no valid or active worksheets.")

            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                raise HTTPException(status_code=400, detail="Uploaded Excel file is empty.")
            
            headers = [str(cell) if cell is not None else "" for cell in rows[0]]
            data_rows = [
                [str(cell) if cell is not None else "" for cell in row]
                for row in rows[1:]
                if any(cell is not None and str(cell).strip() != "" for cell in row)
            ]
            return headers, data_rows

        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a .csv or .xlsx file.")

    @staticmethod
    async def import_customers(
        file: UploadFile, 
        db: AsyncIOMotorDatabase, 
        uploader_officer_id: Optional[str] = None,
        user_id_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process rows, clear previous records for this field officer to optimize storage, and insert new records into MongoDB."""
        headers, data_rows = await CustomerImportService.parse_file_rows(file)
        mapping = CustomerImportService.get_column_mapping(headers)

        if 'customer_id' not in mapping and len(headers) >= 1:
            mapping['customer_id'] = 0

        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        today = datetime.utcnow()
        default_due_date = (today + timedelta(days=15)).strftime("%Y-%m-%d")

        # Overwrite: Delete previous customer & meter records for this field officer
        deleted_count = 0
        officer_match = []
        if uploader_officer_id:
            officer_match.extend([
                {"assigned_officer_id": uploader_officer_id},
                {"uploaded_by_officer_id": uploader_officer_id}
            ])
        if user_id_str:
            officer_match.extend([
                {"assigned_officer_id": user_id_str},
                {"uploaded_by_officer_id": user_id_str}
            ])

        if officer_match:
            del_cus_res = await db.customers.delete_many({"$or": officer_match})
            del_mtr_res = await db.meters.delete_many({"$or": officer_match})
            deleted_count = del_cus_res.deleted_count

        inserted_count = 0
        updated_count = 0
        errors = []

        for row_idx, row in enumerate(data_rows, start=2):
            try:
                def get_val(key: str, default: str = "") -> str:
                    if key in mapping and mapping[key] < len(row):
                        return str(row[mapping[key]]).strip()
                    return default

                customer_id = get_val('customer_id')
                if not customer_id:
                    customer_id = f"CUS{10000 + row_idx}"

                name = get_val('name') or f"Consumer {customer_id}"
                meter_number = get_val('meter_number') or f"MTR-{customer_id}"

                # Parse coordinates (latitude, longitude)
                lat = 21.1458
                lng = 79.0882

                if 'latitude' in mapping and 'longitude' in mapping:
                    try:
                        lat = float(get_val('latitude', '21.1458'))
                        lng = float(get_val('longitude', '79.0882'))
                    except ValueError:
                        pass
                elif 'lang_long' in mapping:
                    lang_long_str = get_val('lang_long')
                    if ',' in lang_long_str:
                        parts = lang_long_str.split(',')
                        try:
                            lat = float(parts[0].strip())
                            lng = float(parts[1].strip())
                        except ValueError:
                            pass
                    elif ' ' in lang_long_str:
                        parts = lang_long_str.split()
                        try:
                            lat = float(parts[0].strip())
                            lng = float(parts[1].strip())
                        except ValueError:
                            pass

                # Parse pending amount
                pending_amount = 0.0
                raw_amt = get_val('pending_amount', '0')
                clean_amt = raw_amt.replace('$', '').replace('₹', '').replace(',', '').strip()
                try:
                    pending_amount = float(clean_amt)
                except ValueError:
                    pending_amount = 0.0

                address = get_val('address') or f"Plot {row_idx}, Central Sector"
                area = get_val('area') or "Central Area"

                status = "overdue" if pending_amount > 3000 else ("pending" if pending_amount > 0 else "paid")
                priority = "high" if pending_amount > 5000 else "normal"

                location = {
                    "type": "Point",
                    "coordinates": [lng, lat]
                }

                officer_id_to_assign = uploader_officer_id or ("OFF-1001" if (row_idx % 2 == 0) else "OFF-1002")

                dtc_raw = get_val('dtc_code')
                if dtc_raw:
                    if dtc_raw.endswith('.0'):
                        dtc_raw = dtc_raw[:-2]
                    clean_dtc = dtc_raw.strip()
                    if clean_dtc.isdigit() and len(clean_dtc) <= 7:
                        dtc_code = clean_dtc.zfill(7)
                    else:
                        dtc_code = clean_dtc
                else:
                    dtc_code = f"786578{5 + (row_idx % 6)}"

                customer_doc = {
                    "customer_id": customer_id,
                    "name": name,
                    "phone": f"+91 98{row_idx:02d}001122",
                    "email": f"customer_{customer_id.lower()}@example.com",
                    "address": address,
                    "area": area,
                    "latitude": lat,
                    "longitude": lng,
                    "location": location,
                    "meter_number": meter_number,
                    "dtc_code": dtc_code,
                    "pending_amount": pending_amount,
                    "due_date": default_due_date,
                    "status": status,
                    "priority": priority,
                    "assigned_officer_id": officer_id_to_assign,
                    "uploaded_by_officer_id": uploader_officer_id or officer_id_to_assign,
                    "updated_at": now_str
                }

                existing = await db.customers.find_one({"customer_id": customer_id})
                if existing:
                    await db.customers.update_one({"customer_id": customer_id}, {"$set": customer_doc})
                    updated_count += 1
                else:
                    customer_doc["created_at"] = now_str
                    await db.customers.insert_one(customer_doc)
                    inserted_count += 1

                # Upsert associated Meter document
                meter_id = f"MTR-{meter_number}"
                meter_doc = {
                    "meter_id": meter_id,
                    "meter_number": meter_number,
                    "customer_id": customer_id,
                    "latitude": lat,
                    "longitude": lng,
                    "assigned_officer_id": customer_doc.get("assigned_officer_id"),
                    "uploaded_by_officer_id": customer_doc.get("uploaded_by_officer_id")
                }


                await db.meters.update_one(
                    {"customer_id": customer_id, "meter_number": meter_number},
                    {"$set": meter_doc},
                    upsert=True
                )

            except Exception as e:
                errors.append(f"Row {row_idx}: {str(e)}")

        return {
            "success": True,
            "filename": file.filename,
            "total_processed": len(data_rows),
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "deleted_count": deleted_count,
            "errors": errors
        }
