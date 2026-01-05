"use client";

import type { Note } from "@ncfritz/olympus-sdk/minerva";

export type OlympusEvent<T> = Event & {
  detail: T;
};

export type NoteEvent = {
  note: Note;
};

export const subscribe = (
  eventName: string,
  listener: EventListenerOrEventListenerObject,
) => {
  document.addEventListener(eventName, listener);
};

export const unsubscribe = (
  eventName: string,
  listener: EventListenerOrEventListenerObject,
) => {
  document.removeEventListener(eventName, listener);
};

export const publish = <T>(eventName: string, data?: T) => {
  const event = new CustomEvent<T>(eventName, { detail: data });
  document.dispatchEvent(event);
};
