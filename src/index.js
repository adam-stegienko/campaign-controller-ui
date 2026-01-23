import ReactDOM from "react-dom/client";
import "./index.css";
// Load OpenTelemetry before app to capture document-load
import "./otel";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

reportWebVitals(console.log);
