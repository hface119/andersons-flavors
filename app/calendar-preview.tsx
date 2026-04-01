"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
}

interface Props {
  events: CalendarEvent[];
}

export default function CalendarPreview({ events }: Props) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, listPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,dayGridWeek,listWeek",
      }}
      events={events}
      height="auto"
      eventDisplay="block"
      dayMaxEvents={5}
      moreLinkClick="popover"
    />
  );
}
