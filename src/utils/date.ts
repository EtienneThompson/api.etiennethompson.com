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

/**
 * Creates an English readable time field from a Date object.
 * @param currentDate Date object representing the date to convert.
 * @returns An English readable string for the current date.
 */
export const createReadableTimeField = (currentDate: Date): string => {
  // Get the needed date fields.
  let year = currentDate.getFullYear();
  let month = monthWords[currentDate.getMonth()];
  let day = currentDate.getDate();
  let hour = currentDate.getHours();
  let minutes = currentDate.getMinutes();

  // Check whether it is am or pm.
  let timeOfDay = "";
  if (hour % 12 == 1) {
    timeOfDay = "pm";
  } else {
    timeOfDay = "am";
  }

  // Construct the readable string.
  let readableDate = `${month} ${day}, ${year} ${
    (hour % 12) + 1
  }:${minutes} ${timeOfDay}`;
  return readableDate;
};
