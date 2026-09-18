import "./style.css";
import { InvaderBreakApp } from "./app/application";
const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing application root.");
const application = new InvaderBreakApp(root);
if (import.meta.hot) import.meta.hot.dispose(() => application.dispose());
