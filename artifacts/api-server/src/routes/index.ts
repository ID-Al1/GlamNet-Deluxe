import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import stylistsRouter from "./stylists";
import appointmentsRouter from "./appointments";
import messagesRouter from "./messages";
import castingRouter from "./casting";
import dashboardRouter from "./dashboard";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(stylistsRouter);
router.use(appointmentsRouter);
router.use(messagesRouter);
router.use(castingRouter);
router.use(dashboardRouter);
router.use(stripeRouter);

export default router;
