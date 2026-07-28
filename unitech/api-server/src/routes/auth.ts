import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, username));
  if (!admin) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  (req.session as any).adminId = admin.id;
  (req.session as any).adminUsername = admin.username;
  res.json({ admin: { id: admin.id, username: admin.username } });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const adminId = (req.session as any).adminId;
  const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, adminId));
  if (!admin) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }
  res.json({ id: admin.id, username: admin.username });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  const adminId = (req.session as any).adminId;
  const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, adminId));
  if (!admin) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(adminTable).set({ passwordHash: hash }).where(eq(adminTable.id, adminId));
  res.json({ message: "Password changed successfully" });
});

export default router;
