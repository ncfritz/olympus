"use client";

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

export const publish = (eventName: string, data?: any) => {
  const event = new CustomEvent(eventName, { detail: data });
  document.dispatchEvent(event);
};
