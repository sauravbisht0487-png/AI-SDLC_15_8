import { Router } from "express";
import { signup, login } from "../controllers/authController";
import { authenticate, AuthRequest } from "../middlewares/authenticate";


const router = Router();

router.get("/me", authenticate, (req: AuthRequest, res) => {
  res.json({ message: "You are authenticated", userId: req.userId });
});

router.post("/signup", signup);
router.post("/login", login);

export default router;