import React from "react";
import { chronologicalSlots } from "./schedule.js";
function time(value, zone) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
const sources = {
  CLASS: "Em aula",
  RESERVATION: "Reservada",
  MIXED: "Ocupada",
};
export default function RoomAgenda({ availability, onChooseSlot }) {
  const slots = chronologicalSlots(availability);
  const allFree = availability.occupied.length === 0;
  return (
    <div className="room-agenda">
      <h3>Agenda do dia</h3>
      {allFree && (
        <p className="notice">
          Nenhuma aula ou reserva neste dia. A sala está livre das 07h às 23h.
        </p>
      )}
      {!availability.available.length && (
        <p className="notice">Não há intervalos livres neste dia.</p>
      )}
      <ol className="agenda-list" aria-label="Todos os intervalos da sala">
        {slots.map((slot, index) => (
          <li
            key={index}
            className={"agenda-block " + (slot.occupied ? "occupied" : "free")}
          >
            <div className="agenda-clock">
              <time dateTime={slot.startTime}>
                {time(slot.startTime, availability.zone)}
              </time>
              <span>até</span>
              <time dateTime={slot.endTime}>
                {time(slot.endTime, availability.zone)}
                {new Intl.DateTimeFormat("en-CA", {
                  timeZone: availability.zone,
                }).format(new Date(slot.startTime)) !==
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: availability.zone,
                }).format(new Date(slot.endTime))
                  ? " do dia seguinte"
                  : ""}
              </time>
            </div>
            <div className="agenda-description">
              <strong>
                {slot.occupied
                  ? sources[slot.source] || "Ocupada"
                  : "Disponível para reservar"}
              </strong>
              <small>
                {slot.occupied
                  ? "A sala está ocupada neste intervalo."
                  : "Escolha este intervalo ou ajuste os horários abaixo."}
              </small>
            </div>
            {!slot.occupied && (
              <button
                type="button"
                className="secondary"
                onClick={() => onChooseSlot(slot)}
              >
                Usar horário
              </button>
            )}
          </li>
        ))}
      </ol>
      {!!availability.classes?.length && (
        <details className="class-details" open>
          <summary>Aulas deste dia ({availability.classes.length})</summary>
          <div className="lesson-list">
            {availability.classes.map((lesson, index) => (
              <article key={index} className="lesson-card">
                <span className="lesson-clock">
                  {time(lesson.startTime, availability.zone)} até{" "}
                  {time(lesson.endTime, availability.zone)}
                </span>
                <strong>{lesson.description || "Aula"}</strong>
                <small>{lesson.group || "Turma não informada"}</small>
              </article>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
