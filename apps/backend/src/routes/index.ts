import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import sectorsRouter from "./sectors";
import visitorsRouter from "./visitors";
import visitsRouter from "./visits";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import auditRouter from "./audit";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(sectorsRouter);
router.use(visitorsRouter);
router.use(visitsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(auditRouter);
router.use(configRouter);

export default router;
