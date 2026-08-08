from fastapi import FastAPI
from app.routes import auth
from app.routes import documents

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI()

app.include_router(auth.router)

app.include_router(documents.router)