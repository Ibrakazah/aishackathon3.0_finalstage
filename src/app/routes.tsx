import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Schedule } from "./components/Schedule";
import { ChatSummary } from "./components/ChatSummary";
import { Reports } from "./components/Reports";
import { SuggestionsProblems } from "./components/SuggestionsProblems";
import { DirectorCalendar } from "./components/DirectorCalendar";
import { StaffDatabase } from "./components/StaffDatabase";
import { OrderDatabase } from "./components/OrderDatabase";
import { TeacherDatabase } from "./components/TeacherDatabase";
import { StaffSchedule } from "./components/StaffSchedule";
import { ScheduleGenerator } from "./components/ScheduleGenerator";
import { ChatBot } from "./components/ChatBot";
import { TeacherView } from "./components/TeacherView";
import { TechnicianView } from "./components/TechnicianView";

export const router = createBrowserRouter([
  { path: "/staff/:name", Component: StaffSchedule }, // Secret standalone layout
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Schedule },
      { path: "schedule", Component: Schedule },
      { path: "chat-summary", Component: ChatSummary },
      { path: "reports", Component: Reports },
      { path: "suggestions", Component: SuggestionsProblems },
      { path: "calendar", Component: DirectorCalendar },
      { path: "chat-bot", Component: ChatBot },
      { path: "schedule-generator", Component: ScheduleGenerator },
      { path: "teacher-view", Component: TeacherView },
      { path: "technician-view", Component: TechnicianView },
    ],
  },
]);