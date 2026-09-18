import math
import httpx
import logging
from typing import Dict, Any, List, Tuple
from app.config import settings
from app.schemas.route import (
    RouteCalculationResponse,
    Coordinates,
    RouteStep,
    MultiRouteCustomerInput,
    MultiRouteStop,
    MultiRouteCalculationResponse
)

logger = logging.getLogger("uvicorn.error")

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lng coordinates."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def encode_polyline(points: List[Tuple[float, float]]) -> str:
    """Simple polyline encoder for fallbacks."""
    result = []
    prev_lat = 0
    prev_lng = 0
    for lat, lng in points:
        late5 = int(round(lat * 1e5))
        lnge5 = int(round(lng * 1e5))

        dlat = late5 - prev_lat
        dlng = lnge5 - prev_lng

        prev_lat = late5
        prev_lng = lnge5

        for val in (dlat, dlng):
            val = ~(val << 1) if val < 0 else (val << 1)
            while val >= 0x20:
                result.append(chr((0x20 | (val & 0x1f)) + 63))
                val >>= 5
            result.append(chr(val + 63))
    return "".join(result)

def decode_polyline(polyline_str: str) -> List[Coordinates]:
    """Decode a Google encoded polyline string into a list of Coordinates."""
    if not polyline_str:
        return []
    index, lat, lng = 0, 0, 0
    coordinates = []
    length = len(polyline_str)
    while index < length:
        # Decode Latitude
        shift, result = 0, 0
        while True:
            if index >= length:
                break
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        # Decode Longitude
        shift, result = 0, 0
        while True:
            if index >= length:
                break
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coordinates.append(Coordinates(latitude=lat * 1e-5, longitude=lng * 1e-5))
    return coordinates

class MapsService:

    @staticmethod
    async def calculate_route(
        origin_lat: float, origin_lng: float,
        dest_lat: float, dest_lng: float
    ) -> RouteCalculationResponse:
        """
        Calculate route using Google Routes API if valid key available,
        else use OSRM (Open Source Routing Machine) for exact real-road street geometry & turn steps.
        """
        # 1. Try Google Routes API if valid key provided
        if settings.GOOGLE_MAPS_API_KEY and settings.GOOGLE_MAPS_API_KEY not in ("YOUR_GOOGLE_MAPS_API_KEY_HERE", "AIzaSyBmEXi6-U51MCj8NO_6lKrptP9IYSH39Is"):
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
                    headers = {
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs"
                    }
                    payload = {
                        "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
                        "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
                        "travelMode": "DRIVE",
                        "routingPreference": "TRAFFIC_AWARE"
                    }
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        if "routes" in data and len(data["routes"]) > 0:
                            route = data["routes"][0]
                            dist = route.get("distanceMeters", 0)
                            dur_str = route.get("duration", "0s").replace("s", "")
                            dur_sec = float(dur_str) if dur_str else 0.0
                            polyline = route.get("polyline", {}).get("encodedPolyline", "")
                            decoded_coords = decode_polyline(polyline)

                            return RouteCalculationResponse(
                                distance_meters=float(dist),
                                distance_text=f"{dist / 1000.0:.1f} km" if dist >= 1000 else f"{int(dist)} m",
                                duration_seconds=dur_sec,
                                duration_text=f"{int(dur_sec // 60)} min" if dur_sec >= 60 else f"{int(dur_sec)} sec",
                                start_address=f"Officer Location ({origin_lat:.4f}, {origin_lng:.4f})",
                                end_address=f"Meter Location ({dest_lat:.4f}, {dest_lng:.4f})",
                                encoded_polyline=polyline,
                                coordinates_path=decoded_coords if decoded_coords else [
                                    Coordinates(latitude=origin_lat, longitude=origin_lng),
                                    Coordinates(latitude=dest_lat, longitude=dest_lng)
                                ],
                                steps=[]
                            )
            except Exception as e:
                logger.warning(f"Google Routes API call failed, using OSRM fallback: {e}")

        # 2. Try OSRM (Open Source Routing Machine) for exact real-road street geometry & turn steps
        try:
            osrm_url = f"https://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson&steps=true"
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(osrm_url)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        osrm_route = data["routes"][0]
                        dist_m = float(osrm_route.get("distance", 0))
                        dur_s = float(osrm_route.get("duration", 0))

                        # Extract real street coordinates from GeoJSON
                        geo_coords = osrm_route.get("geometry", {}).get("coordinates", [])
                        coords_path = [
                            Coordinates(latitude=pt[1], longitude=pt[0])
                            for pt in geo_coords
                        ]

                        # Extract turn-by-turn steps
                        steps: List[RouteStep] = []
                        legs = osrm_route.get("legs", [])
                        if legs:
                            for step in legs[0].get("steps", []):
                                name = step.get("name", "")
                                maneuver = step.get("maneuver", {})
                                m_type = maneuver.get("type", "")
                                modifier = maneuver.get("modifier", "")

                                instruction = f"{m_type.capitalize()} {modifier}".strip()
                                if name:
                                    instruction += f" onto {name}"
                                if not instruction or instruction == "Depart":
                                    instruction = f"Head along {name if name else 'street'} towards meter"

                                s_dist = step.get("distance", 0)
                                s_dur = step.get("duration", 0)

                                steps.append(RouteStep(
                                    instruction=instruction,
                                    distance_text=f"{s_dist / 1000.0:.1f} km" if s_dist >= 1000 else f"{int(s_dist)} m",
                                    duration_text=f"{int(s_dur // 60)} min" if s_dur >= 60 else f"{int(s_dur)} sec",
                                    start_location=Coordinates(latitude=origin_lat, longitude=origin_lng),
                                    end_location=Coordinates(latitude=dest_lat, longitude=dest_lng)
                                ))

                        dist_formatted = f"{dist_m / 1000.0:.2f} km" if dist_m >= 1000 else f"{int(dist_m)} m"
                        dur_formatted = f"{int(dur_s // 60)} min" if dur_s >= 60 else "< 1 min"

                        return RouteCalculationResponse(
                            distance_meters=round(dist_m, 1),
                            distance_text=dist_formatted,
                            duration_seconds=round(dur_s, 1),
                            duration_text=dur_formatted,
                            start_address=f"Officer Location ({origin_lat:.4f}, {origin_lng:.4f})",
                            end_address=f"Meter Location ({dest_lat:.4f}, {dest_lng:.4f})",
                            encoded_polyline="",
                            coordinates_path=coords_path if coords_path else [
                                Coordinates(latitude=origin_lat, longitude=origin_lng),
                                Coordinates(latitude=dest_lat, longitude=dest_lng)
                            ],
                            steps=steps if steps else [
                                RouteStep(
                                    instruction="Proceed along main road to electricity meter",
                                    distance_text=dist_formatted,
                                    duration_text=dur_formatted,
                                    start_location=Coordinates(latitude=origin_lat, longitude=origin_lng),
                                    end_location=Coordinates(latitude=dest_lat, longitude=dest_lng)
                                )
                            ]
                        )
        except Exception as e:
            logger.warning(f"OSRM Routing failed, using Haversine calculation: {e}")

        # 3. Last Resort Fallback Calculation using Haversine + Manhattan street grid simulation
        air_distance = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        urban_distance = air_distance * 1.35
        duration_sec = urban_distance / 6.94

        mid_lat = dest_lat
        mid_lng = origin_lng

        points = [
            (origin_lat, origin_lng),
            (mid_lat, mid_lng),
            (dest_lat, dest_lng)
        ]
        
        encoded_poly = encode_polyline(points)

        coords_path = [
            Coordinates(latitude=origin_lat, longitude=origin_lng),
            Coordinates(latitude=mid_lat, longitude=mid_lng),
            Coordinates(latitude=dest_lat, longitude=dest_lng)
        ]

        steps = [
            RouteStep(
                instruction="Head towards target area along main street",
                distance_text=f"{urban_distance * 0.6 / 1000.0:.1f} km",
                duration_text=f"{int((duration_sec * 0.6) // 60)} min",
                start_location=Coordinates(latitude=origin_lat, longitude=origin_lng),
                end_location=Coordinates(latitude=mid_lat, longitude=mid_lng)
            ),
            RouteStep(
                instruction="Turn into customer alley / street towards electricity meter",
                distance_text=f"{urban_distance * 0.4 / 1000.0:.1f} km",
                duration_text=f"{int((duration_sec * 0.4) // 60)} min",
                start_location=Coordinates(latitude=mid_lat, longitude=mid_lng),
                end_location=Coordinates(latitude=dest_lat, longitude=dest_lng)
            )
        ]

        dist_formatted = f"{urban_distance / 1000.0:.2f} km" if urban_distance >= 1000 else f"{int(urban_distance)} m"
        dur_formatted = f"{int(duration_sec // 60)} min" if duration_sec >= 60 else "< 1 min"

        return RouteCalculationResponse(
            distance_meters=round(urban_distance, 1),
            distance_text=dist_formatted,
            duration_seconds=round(duration_sec, 1),
            duration_text=dur_formatted,
            start_address=f"Officer Location ({origin_lat:.4f}, {origin_lng:.4f})",
            end_address=f"Meter Location ({dest_lat:.4f}, {dest_lng:.4f})",
            encoded_polyline=encoded_poly,
            coordinates_path=coords_path,
            steps=steps
        )

    @staticmethod
    async def calculate_multi_route(
        origin_lat: float,
        origin_lng: float,
        customers: List[MultiRouteCustomerInput]
    ) -> MultiRouteCalculationResponse:
        if not customers:
            return MultiRouteCalculationResponse(
                total_distance_meters=0,
                total_distance_text="0 m",
                total_duration_seconds=0,
                total_duration_text="0 min",
                coordinates_path=[],
                stops=[]
            )

        # 1. TSP Nearest-Neighbor Algorithm starting from Origin
        unvisited = list(range(len(customers)))
        tour = []
        curr_lat, curr_lng = origin_lat, origin_lng

        while unvisited:
            best_idx = None
            best_dist = float('inf')
            for idx in unvisited:
                c = customers[idx]
                d = haversine_distance(curr_lat, curr_lng, c.latitude, c.longitude)
                if d < best_dist:
                    best_dist = d
                    best_idx = idx
            tour.append(best_idx)
            unvisited.remove(best_idx)
            curr_lat, curr_lng = customers[best_idx].latitude, customers[best_idx].longitude

        # 2. 2-Opt Optimization for TSP
        def get_tour_distance(t):
            dist = 0.0
            prev_lat, prev_lng = origin_lat, origin_lng
            for i in t:
                c = customers[i]
                dist += haversine_distance(prev_lat, prev_lng, c.latitude, c.longitude)
                prev_lat, prev_lng = c.latitude, c.longitude
            return dist

        improved = True
        while improved:
            improved = False
            best_d = get_tour_distance(tour)
            for i in range(len(tour) - 1):
                for j in range(i + 1, len(tour)):
                    new_tour = tour[:i] + tour[i:j+1][::-1] + tour[j+1:]
                    new_d = get_tour_distance(new_tour)
                    if new_d < best_d - 1.0:
                        tour = new_tour
                        best_d = new_d
                        improved = True
                        break
                if improved:
                    break

        # Build Waypoint Sequence: [Origin, Stop 1, Stop 2, ..., Stop N]
        points = [(origin_lat, origin_lng)] + [
            (customers[idx].latitude, customers[idx].longitude) for idx in tour
        ]

        total_distance = 0.0
        total_duration = 0.0
        full_coords_path: List[Coordinates] = [Coordinates(latitude=origin_lat, longitude=origin_lng)]
        stops: List[MultiRouteStop] = []

        async with httpx.AsyncClient(timeout=10.0) as client:
            for seq_i in range(len(tour)):
                c_idx = tour[seq_i]
                cust = customers[c_idx]
                prev_p = points[seq_i]
                curr_p = points[seq_i + 1]

                leg_dist = 0.0
                leg_dur = 0.0
                leg_coords: List[Coordinates] = []

                try:
                    osrm_url = f"https://router.project-osrm.org/route/v1/driving/{prev_p[1]},{prev_p[0]};{curr_p[1]},{curr_p[0]}?overview=full&geometries=geojson"
                    res = await client.get(osrm_url)
                    if res.status_code == 200:
                        data = res.json()
                        if data.get("code") == "Ok" and data.get("routes"):
                            r = data["routes"][0]
                            leg_dist = float(r.get("distance", 0))
                            leg_dur = float(r.get("duration", 0))
                            geo_coords = r.get("geometry", {}).get("coordinates", [])
                            leg_coords = [Coordinates(latitude=pt[1], longitude=pt[0]) for pt in geo_coords]
                except Exception as e:
                    logger.warning(f"OSRM leg routing error: {e}")

                if not leg_coords or len(leg_coords) < 2:
                    air_d = haversine_distance(prev_p[0], prev_p[1], curr_p[0], curr_p[1])
                    leg_dist = air_d * 1.35
                    leg_dur = leg_dist / 6.94
                    # Generate street corner waypoint so fallback route follows road grid instead of cutting across blocks
                    mid_lat = curr_p[0]
                    mid_lng = prev_p[1]
                    leg_coords = [
                        Coordinates(latitude=prev_p[0], longitude=prev_p[1]),
                        Coordinates(latitude=mid_lat, longitude=mid_lng),
                        Coordinates(latitude=curr_p[0], longitude=curr_p[1])
                    ]

                total_distance += leg_dist
                total_duration += leg_dur

                for pt in leg_coords:
                    if not (full_coords_path and full_coords_path[-1].latitude == pt.latitude and full_coords_path[-1].longitude == pt.longitude):
                        full_coords_path.append(pt)

                dist_text = f"{leg_dist / 1000.0:.2f} km" if leg_dist >= 1000 else f"{int(leg_dist)} m"
                dur_text = f"{int(leg_dur // 60)} min" if leg_dur >= 60 else "< 1 min"

                stops.append(
                    MultiRouteStop(
                        sequence=seq_i + 1,
                        customer_id=cust.customer_id,
                        name=cust.name,
                        meter_number=cust.meter_number,
                        pending_amount=cust.pending_amount,
                        address=cust.address or "",
                        latitude=cust.latitude,
                        longitude=cust.longitude,
                        distance_from_prev_meters=round(leg_dist, 1),
                        distance_from_prev_text=dist_text,
                        duration_from_prev_text=dur_text
                    )
                )

        total_dist_text = f"{total_distance / 1000.0:.2f} km" if total_distance >= 1000 else f"{int(total_distance)} m"
        total_dur_text = f"{int(total_duration // 60)} min" if total_duration >= 60 else "< 1 min"

        return MultiRouteCalculationResponse(
            total_distance_meters=round(total_distance, 1),
            total_distance_text=total_dist_text,
            total_duration_seconds=round(total_duration, 1),
            total_duration_text=total_dur_text,
            coordinates_path=full_coords_path,
            stops=stops
        )


