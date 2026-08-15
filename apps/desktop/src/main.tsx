import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CalculatorApp from "../../../app/CalculatorApp";
import "../../../app/globals.css";
import "./desktop.css";

document.documentElement.dataset.runtime = "desktop";

const root = document.getElementById("root");
if (!root) throw new Error("Desktop application root was not found.");

createRoot(root).render(
  <StrictMode>
    <CalculatorApp />
  </StrictMode>,
);
