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
 * Get a datetime string which is hour and minutes in the future.
 * @param hour The number of hours in the future.
 * @param minutes The number of minutes in the future.
 * @returns String ISO format future date time.
 */
const createExpiration = (hour: number, minutes: number): string => {
  let now = new Date();
  now.setHours(now.getHours() + hour);
  now.setMinutes(now.getMinutes() + minutes);
  let expiration = now.toISOString();
  expiration = expiration.replace("T", " ").split(".")[0];
  return expiration;
};

/**
 * Creates a string which is 8 hours in the future from the current time.
 * @param hour The number of hours to go in the future.
 * @returns string ISO format date time.
 */
export const createHourExpiration = (hour: number = 8): string => {
  return createExpiration(hour, 0);
};

/**
 * Create a string which is minute minutes in the future from the current time.
 * @param minute The number of minutes to go in the future.
 * @returns string ISO format date time.
 */
export const createMinuteExpiration = (minute: number = 15): string => {
  return createExpiration(0, minute);
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
  if (hour / 12 > 1) {
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
