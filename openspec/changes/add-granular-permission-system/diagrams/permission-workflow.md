# Permission Check Workflow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant C as Controller
    participant M as Permission Middleware
    participant S as Permission Service
    participant E as Permission Evaluator
    participant D as Database
    participant R as Resource

    U->>C: Request Resource Access
    C->>M: Check Permission
    M->>S: Evaluate Permissions
    S->>E: Check User Permissions
    
    E->>D: Load User Roles
    D-->>E: Return Roles with Permissions
    E->>E: Evaluate Conditions
    
    alt Has Required Permission
        E-->>S: Permission Granted
        S-->>M: Access Allowed
        M-->>C: Proceed with Request
        C->>R: Access Resource
        R-->>C: Return Resource Data
        C-->>U: Success Response
    else Permission Denied
        E-->>S: Permission Denied
        S-->>M: Access Denied
        M-->>C: 403 Forbidden
        C-->>U: Error Response
    end
    
    Note over E: Log Permission Check Result
    E->>D: Audit Log Entry