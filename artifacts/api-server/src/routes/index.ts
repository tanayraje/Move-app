import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import heroRouter from "./hero";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(heroRouter);

export default router;
