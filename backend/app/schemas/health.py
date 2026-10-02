from pydantic import BaseModel


class HealthData(BaseModel):
    status: str
    database: str
    env: str
