import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicStorageRouter from "./publicStorage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicStorageRouter);

export default router;
