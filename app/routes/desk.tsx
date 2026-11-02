import { Outlet } from "react-router";

import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `EvalDesk — ${APP_TITLE}` }];
}

export default function DeskLayout() {
  return <Outlet />;
}
