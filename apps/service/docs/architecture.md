# Service structural decomposition

## Project structure

1. DB artefacts (seeds and migrations);
2. CLI scripts;
3. Project documentation (e. g. web sequence diagrams, coding style guidelines etc);
4. Runtime source code;
5. Tests.

## Runtime source code structure

Runtime source code is organized by functional components, which have a logically coherent and tight coupling of the contained models. A component (e.g., a User component) is then organized into three different layers:

- API layer: provides an API interface to interact with the domain services;
- Domain layer: contains the actual business logic and domain models;
- Infrastructure layer: binds the business logic implementation to infrastructure and frameworks.

### API layer

The API layer provides an API interface to interact with the application. For example, this could be a REST API backend.

1. Controllers for handling REST, GraphQL, MQ or any other endpoints;

### Domain layer

Domain logic (entities and workflows that are direct reflections of real-world business ones). Ideally code in this group should have no dependencies on external libraries.

1. Commands
2. Events
3. Models
4. Services

### Infrastructure layer

The infrastructure layer binds the elements defined in the domain layer to a specific framework or platform in order to have a runnable application;

1. Repositories;
2. Integrations;
3. Services

#### Repositories sublayer

Repository describes persistence logic for component, providing either basic CRUD methods, or more complex composite operations on persistent data.

#### Integrations sublayer

Integration describes interactions with an external service that component relies upon. It consists of:

1. Request mapper: translates internal data structures into external service request params;
2. Response mapper: translates external service responses into internal data structures;
3. External service requests: reflects actual external service API, accepting same parameters that external service does, and returning same data structures that external service does.
4. Integration service: acts as a facade, exposing and aggregating external service requests in a way that is relevant within the context of service being built.

Credit goes to [Fabian Keller's blog](https://www.fabian-keller.de/blog/domain-driven-design-with-symfony-a-folder-structure/) for laying the base principles for this structure.
