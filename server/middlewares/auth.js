
// Middleware to check userId and hasPremiumPlan

import { clerkClient } from "@clerk/express";

export const auth = async (req, res, next) => {
    try {
        const authData = req.auth();
        const { userId, has } = authData;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: missing or invalid token" });
        }

        const hasPremiumPlan = has ? await has({ plan: 'premium' }) : false;

        const user = await clerkClient.users.getUser(userId);

        if (!hasPremiumPlan && user.privateMetadata.free_usage) {
            req.free_usage = user.privateMetadata.free_usage
        } else {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: 0
                }
            })
            req.free_usage = 0;
        }

        req.plan = hasPremiumPlan ? 'premium' : 'free';
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: error.message })
    }
}