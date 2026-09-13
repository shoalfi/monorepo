import { Router } from "express"
import { postAsk } from "../controllers/ask.controller"

export const askRouter = Router()
askRouter.post("/ask", postAsk)
