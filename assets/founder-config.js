/* ==========================================================================
   Founder Access Configuration
   Overlord AI (overlordai.co)
   
   JP: Change the end date here when paid checkout is live or when extending the window.
   NOTE: As per campaign rules, the banner does NOT auto-hide when the date passes;
   JP will switch it off manually when paid tiers open.
   ========================================================================== */

const FOUNDER_ACCESS_END = "2026-11-15";

function getFounderAccessEndLabel(dateStr) {
  if (!dateStr) return "November 15";
  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const mIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (months[mIdx] && !isNaN(day)) {
      return `${months[mIdx]} ${day}`;
    }
  }
  return dateStr;
}

window.FOUNDER_ACCESS_END = FOUNDER_ACCESS_END;
window.FOUNDER_ACCESS_END_LABEL = getFounderAccessEndLabel(FOUNDER_ACCESS_END);
