import React, { useState, useEffect } from "react";
import "../styles/GoogleResponseComponent.css";
import Configuration from "../services/Configuration.jsx";

export function GoogleResponseComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [googleAdsApiUrl, setGoogleAdsApiUrl] = useState(null);
  const [customerId, setCustomerId] = useState(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        // Load configuration using the centralized service
        await Configuration.loadConfig();

        // Use convenience methods from Configuration service
        const apiUrl = Configuration.get('googleAds.apiUrl');
        const custId = Configuration.get('googleAds.customerId');
        const campaignNames = Configuration.get('googleAds.campaignNames');

        // Validate required configuration
        if (!apiUrl || !custId || !campaignNames) {
          throw new Error('Missing required Google Ads configuration');
        }

        setGoogleAdsApiUrl(apiUrl);
        setCustomerId(custId);

        const url = `${apiUrl}/v1/api/google-ads/campaigns/status?customerId=${custId}&campaignNames=${campaignNames}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const campaigns = await response.json();

        campaigns.forEach((campaign) => {
          console.log(`Campaign ID: ${campaign.id}, Name: ${campaign.name}, Status: ${campaign.status}`);
        });
        console.log("Campaigns fetched successfully");

        const campaignData = campaigns.map((campaign) => ({
          id: campaign.id,
          campaign: campaign.name,
          state: campaign.status,
        }));
        setData(campaignData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching campaigns:", error);
        setError(error);
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  const handleToggleCampaign = async (item) => {
    const isEnabled = item.state === "ENABLED";
    const action = isEnabled ? "suspend" : "resume";
    const url = `${googleAdsApiUrl}/v1/api/google-ads/campaigns/${action}/${encodeURIComponent(item.campaign)}?customerId=${customerId}`;

    setTogglingIds((prev) => new Set(prev).add(item.id));
    setActionError(null);

    try {
      const response = await fetch(url, { method: "PUT" });
      if (!response.ok) {
        throw new Error(`Failed to ${action} campaign: ${response.status}`);
      }

      setData((prev) =>
        prev.map((c) =>
          c.id === item.id
            ? { ...c, state: isEnabled ? "PAUSED" : "ENABLED" }
            : c
        )
      );
    } catch (err) {
      console.error(`Error toggling campaign ${item.campaign}:`, err);
      setActionError(`Failed to ${action} campaign "${item.campaign}": ${err.message}`);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (loading) {
    return <div>Loading Google data...</div>;
  }

  if (error) {
    return <div>Error fetching Google data: {error.message}</div>;
  }

  return (
    <div className="google-container">
      {actionError && (
        <div className="google-action-error">{actionError}</div>
      )}
      {data && data.length > 0 ? (
        <table className="google-responsive">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>State</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const isEnabled = item.state === "ENABLED";
              const isToggling = togglingIds.has(item.id);
              return (
                <tr key={item.id}>
                  <td>{item.campaign}</td>
                  <td>
                    <span className={`campaign-status campaign-status--${item.state.toLowerCase()}`}>
                      {item.state}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`campaign-toggle-btn campaign-toggle-btn--${isEnabled ? "disable" : "enable"}`}
                      onClick={() => handleToggleCampaign(item)}
                      disabled={isToggling}
                    >
                      {isToggling
                        ? isEnabled ? "Suspending..." : "Resuming..."
                        : isEnabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div>No data available</div>
      )}
    </div>
  );
}

export default GoogleResponseComponent;
