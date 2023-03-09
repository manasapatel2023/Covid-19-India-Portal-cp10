const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at: http://localhost:3000");
    });
  } catch (error) {
    console.log(`Server got error at ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//API 1:login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDetailsQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(userDetailsQuery);
  if (userDetails !== undefined) {
    const isPasswordValid = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordValid) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "ab secret key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send(`Invalid password`);
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "ab secret key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`);
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`);
  }
}

//API2:
const convertStateDbObjectAPI1 = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesListQuery = `select * from state;`;
  const getStatesListQueryResponse = await db.all(getStatesListQuery);
  response.send(
    getStatesListQueryResponse.map((eachState) =>
      convertStateDbObjectAPI1(eachState)
    )
  );
});

//API 3:
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesListByIdQuery = `select * from state where state_id = ${stateId};`;
  const getStatesListByIdQueryResponse = await db.get(getStatesListByIdQuery);
  response.send(convertStateDbObjectAPI1(getStatesListByIdQueryResponse));
});

//API 4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths)
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrictQueryResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5:
const convertDbObjectAPI5 = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIdQuery = `select * from district where district_id='${districtId}';`;
    const getDistrictByIdQueryResponse = await db.get(getDistrictByIdQuery);
    response.send(convertDbObjectAPI5(getDistrictByIdQueryResponse));
  }
);

//API 6:Delete

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id='${districtId}';`;
    const deleteDistrictQueryRes = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7:PUT
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `update district set 
    district_name='${districtName}',state_id='${stateId}',cases='${cases}',
    cured='${cured}',active='${active}',deaths='${deaths}' WHERE district_id='${districtId}';`;
    const updateDistrictQueryRes = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8:total cases
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    //const { totalCases, totalCured, totalActive, totalDeaths } = request.body;
    const getTotalQuery = `SELECT sum(cases) as totalCases ,sum(cured) as totalCured,
    sum(active) as totalActive,sum(deaths) as totalDeaths FROM district WHERE state_id='${stateId}';`;
    const getTotalQueryRes = await db.get(getTotalQuery);
    response.send(getTotalQueryRes);
  }
);

module.exports = app;
