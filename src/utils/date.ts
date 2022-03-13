const monthWords = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Creates a string which is 2 hours in the future from the current time.
 * @returns string ISO format date time.
 */
export const createExpiration = (): string => {
  let now = new Date();
  now.setHours(now.getHours() + 2);
  let expiration = now.toISOString();
  expiration = expiration.replace("T", " ").split(".")[0];
  return expiration;
};

/**
 * Returns the current time.
 * @returns string ISO format date time.
 */
export const getCurrentTimeField = (): string => {
  let now = new Date().toISOString();
  now = now.replace("T", " ").split(".")[0];
  return now;
};

export const createReadableTimeField = (currentDate: Date): string => {
  let year = currentDate.getFullYear();
  let month = monthWords[currentDate.getMonth()];
  let day = currentDate.getDate();
  let hour = currentDate.getHours();
  let minutes = currentDate.getMinutes();

  let timeOfDay = "";
  if (hour % 12 == 1) {
    timeOfDay = "pm";
  } else {
    timeOfDay = "am";
  }

  let readableDate = `${month} ${day}, ${year} ${
    (hour % 12) + 1
  }:${minutes} ${timeOfDay}`;
  return readableDate;
};
