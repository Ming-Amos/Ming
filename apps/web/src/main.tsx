import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Welcome from "./components/Welcome";
import "./index.css";
import "./workspace.css";
import "./studio.css";

function MingEntry() {
  const [inStudio, setInStudio] = React.useState(() => window.location.hash === "#studio");
  React.useEffect(() => {
    const navigate = () => setInStudio(window.location.hash === "#studio");
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  return inStudio ? <App /> : <Welcome />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MingEntry />
  </React.StrictMode>
);
