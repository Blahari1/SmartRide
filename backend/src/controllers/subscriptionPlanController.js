const SubscriptionPlan = require("../models/SubscriptionPlan");

// GET /api/subscription-plans
// Public: customers can see active plans only.
const getActivePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .select("-__v")
      .sort({ durationMonths: 1 });

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("Get active plans error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
    });
  }
};

// GET /api/subscription-plans/admin
// Admin: see active and inactive plans.
const getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find()
      .select("-__v")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("Get all plans error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
};

// POST /api/subscription-plans
const createPlan = async (req, res) => {
  try {
    const allowedFields = ["name", "slug", "durationMonths", "description", "features"];
    const unknown = Object.keys(req.body || {}).filter((key) => !allowedFields.includes(key));
    if (unknown.length) {
      return res.status(400).json({ success: false, message: `Unknown plan field(s): ${unknown.join(", ")}` });
    }
    const {
      name,
      slug,
      durationMonths,
      description = "",
      features = [],
    } = req.body;

    if (
      !name ||
      !slug ||
      durationMonths === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, slug and durationMonths are required",
      });
    }

    if (![1, 3, 6, 12, 24, 36, 48, 60].includes(Number(durationMonths))) {
      return res.status(400).json({
        success: false,
        message: "durationMonths must be 1, 3, 6, 12, 24, 36, 48 or 60",
      });
    }

    if (
      !Array.isArray(features) ||
      !features.every(
        (item) => typeof item === "string" && item.trim().length > 0,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "features must be an array of non-empty strings",
      });
    }

    const cleanSlug = String(slug).trim().toLowerCase();

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      return res.status(400).json({
        success: false,
        message: "Slug can contain lowercase letters, numbers and hyphens",
      });
    }

    const plan = await SubscriptionPlan.create({
      name: String(name).trim(),
      slug: cleanSlug,
      durationMonths: Number(durationMonths),
      description: String(description).trim(),
      features: features.map((item) => item.trim()),
    });

    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      plan,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A plan with this slug already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create subscription plan",
    });
  }
};

// PATCH /api/subscription-plans/:id
const updatePlan = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "slug",
      "durationMonths",
      "description",
      "features",
    ];

    const unknown = Object.keys(req.body || {}).filter((key) => !allowedFields.includes(key));
    if (unknown.length) {
      return res.status(400).json({ success: false, message: `Unknown plan field(s): ${unknown.join(", ")}` });
    }
    const updates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || !updates.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "name must be a non-empty string",
        });
      }
      updates.name = updates.name.trim();
    }

    if (updates.durationMonths !== undefined && ![1, 3, 6, 12, 24, 36, 48, 60].includes(Number(updates.durationMonths))) {
      return res.status(400).json({ success: false, message: "Unsupported subscription duration" });
    }
    if (updates.durationMonths !== undefined) updates.durationMonths = Number(updates.durationMonths);

    if (updates.slug !== undefined) {
      if (typeof updates.slug !== "string") {
        return res.status(400).json({
          success: false,
          message: "slug must be a string",
        });
      }

      updates.slug = updates.slug.trim().toLowerCase();

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(updates.slug)) {
        return res.status(400).json({
          success: false,
          message: "Invalid slug format",
        });
      }
    }

    if (
      updates.durationMonths !== undefined &&
      ![1, 3, 12].includes(Number(updates.durationMonths))
    ) {
      return res.status(400).json({
        success: false,
        message: "durationMonths must be 1, 3, 6, 12, 24, 36, 48 or 60",
      });
    }

    if (updates.durationMonths !== undefined) {
      updates.durationMonths = Number(updates.durationMonths);
    }

    if (updates.description !== undefined) {
      if (typeof updates.description !== "string") {
        return res.status(400).json({
          success: false,
          message: "description must be a string",
        });
      }
      updates.description = updates.description.trim();
    }

    if (
      updates.features !== undefined &&
      (!Array.isArray(updates.features) ||
        !updates.features.every(
          (item) => typeof item === "string" && item.trim().length > 0,
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "features must be an array of non-empty strings",
      });
    }

    if (updates.features !== undefined) {
      updates.features = updates.features.map((item) => item.trim());
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-__v");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully",
      plan,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A plan with this slug already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    console.error("Update plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update subscription plan",
    });
  }
};

// PATCH /api/subscription-plans/:id/status
const updatePlanStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive } },
      { new: true, runValidators: true },
    ).select("-__v");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Plan ${isActive ? "activated" : "deactivated"} successfully`,
      plan,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    console.error("Update plan status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update plan status",
    });
  }
};

module.exports = {
  getActivePlans,
  getAllPlans,
  createPlan,
  updatePlan,
  updatePlanStatus,
};
