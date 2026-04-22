import os
from uuid import uuid4

UPLOAD_DIR = "uploaded_logs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_uploaded_file(file) -> str:
    file_id = str(uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.csv")

    with open(file_path, "wb") as f:
        f.write(file)

    return file_id, file_path
