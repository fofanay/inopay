import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Upgrade page now redirects to the unified Pricing page
 * All pricing and subscription options are now available there
 */
const Upgrade = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/tarifs", { replace: true });
  }, [navigate]);

  return null;
};

export default Upgrade;
