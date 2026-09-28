"use client";

import type { Note } from "@ncfritz/olympus-sdk/minerva";

export enum Events {
  DIONYSUS_BLACK_CURTAIN_LOCK = "dionysus:black-curtain:lock",
  DIONYSUS_MEDIA_SEARCH_COMPLETE = "dionysus:media:search:complete",
  DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED = "dionysus:media:search-configuration:updated",
  DIONYSUS_MEDIA_FAVORITE_UPDATED = "dionysus:media:favorite:updated",
  MINERVA_NOTE_ADDED = "minerva:note:added",
  MINERVA_NOTE_UPDATED = "minerva:note:updated",
  NOTIFICATIONS_PUBLISH_EVENT = "notifications:publish",
  NOTIFICATIONS_REFRESH_EVENT = "notifications:refresh",
}

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
