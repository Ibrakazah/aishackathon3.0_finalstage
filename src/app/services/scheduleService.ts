import { type GeneratedSchedule } from "../components/schedule-gen/GeneratePanel";
import { TEACHER_ASSIGNMENTS } from "../data/teacherAssignments";

export async function fetchActiveSchedule(): Promise<GeneratedSchedule> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000); // 5 sec timeout
  
  try {
    const res = await fetch("http://localhost:8000/api/schedule", { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error("Failed to fetch schedule");
    return await res.json();
  } catch (error) {
    clearTimeout(id);
    console.error("API Fetch error, falling back to local data:", error);
    return {};
  }
}

export async function fetchTeachersList(): Promise<string[]> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch("http://localhost:8000/api/teachers", { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error("Failed to fetch teachers");
    return await res.json();
  } catch (error) {
    clearTimeout(id);
    console.error("API Fetch error, using local teacher data:", error);
    return TEACHER_ASSIGNMENTS.map(t => t.name);
  }
}
