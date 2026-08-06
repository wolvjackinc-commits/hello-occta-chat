UPDATE public.platform_settings
SET customer_journey_v1_enabled = true,
    customer_journey_v2_enabled = true,
    customer_journey_default = 'v2',
    customer_journey_v2_kill_switch = false,
    customer_journey_v2_test_mode = false,
    customer_journey_v2_rollout_percentage = 100,
    customer_journey_v2_abandoned_resume_enabled = false,
    updated_at = now();