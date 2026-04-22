from fastapi import APIRouter, HTTPException
import os
from app.services.analysis_engine import CANAnalysisEngine

router = APIRouter(prefix="/analyze", tags=["Analyze"])

@router.post("/{file_id}")
async def analyze_file(file_id: str):
    file_path = f"uploaded_logs/{file_id}.csv"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    engine = CANAnalysisEngine()
    results = engine.run_full_analysis(file_path)

    return results
