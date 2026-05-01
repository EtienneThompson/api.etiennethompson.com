import app from ".";

require("dotenv").config({ path: `./.env.${process.env.APP_ENV}` });
const port = process.env.PORT || "4000";

app.listen(port, () => {
  return console.log(`Server is listening on port ${port}`);
});
