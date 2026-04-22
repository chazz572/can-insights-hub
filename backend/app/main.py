from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.upload.router import router as upload_router
from app.api.analyze.router import router as analyze_router

app = FastAPI(title="CAN Insights Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "CAN Insights Hub Backend Running"}
