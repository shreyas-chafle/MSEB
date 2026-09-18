from fastapi import APIRouter, Depends
from app.schemas.route import (
    RouteCalculationRequest,
    RouteCalculationResponse,
    MultiRouteCalculationRequest,
    MultiRouteCalculationResponse
)
from app.services.maps_service import MapsService
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/routes", tags=["Routes"])

@router.post("/calculate", response_model=RouteCalculationResponse)
@router.post("/compute", response_model=RouteCalculationResponse)
async def calculate_route(
    request: RouteCalculationRequest,
    current_user: dict = Depends(get_current_user)
):
    return await MapsService.calculate_route(
        origin_lat=request.origin.latitude,
        origin_lng=request.origin.longitude,
        dest_lat=request.destination.latitude,
        dest_lng=request.destination.longitude
    )

@router.post("/calculate-multi", response_model=MultiRouteCalculationResponse)
async def calculate_multi_route(
    request: MultiRouteCalculationRequest,
    current_user: dict = Depends(get_current_user)
):
    return await MapsService.calculate_multi_route(
        origin_lat=request.origin.latitude,
        origin_lng=request.origin.longitude,
        customers=request.customers
    )

