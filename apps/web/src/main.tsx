import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Welcome from "./components/Welcome";
import LiveTrial from "./components/LiveTrial";
import UploadStudio from "./components/UploadStudio";
import "./index.css";
import "./workspace.css";
import "./studio.css";
import "./workbench-theme.css";

function MingEntry() {
  const [route, setRoute] = React.useState(() => window.location.hash);
  React.useEffect(() => {
    const navigate = () => { setRoute(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  return route === "#studio" ? <App /> : route === "#trial" ? <LiveTrial /> : route === "#upload" ? <UploadStudio /> : <Welcome />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MingEntry />
  </React.StrictMode>
);
