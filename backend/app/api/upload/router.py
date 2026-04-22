from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.file_storage import save_uploaded_file

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    file_bytes = await file.read()
    file_id, _ = save_uploaded_file(file_bytes)

    return {"file_id": file_id}
