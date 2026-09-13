import { Router } from "express"
import { getToken, listTokens } from "../controllers/tokens.controller"

export const tokensRouter = Router()
tokensRouter.get("/tokens", listTokens)
tokensRouter.get("/tokens/:address", getToken)
