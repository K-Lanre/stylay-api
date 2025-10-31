# Permission System Architecture Diagram

```mermaid
graph TB
    subgraph "User Layer"
        User[User Entity]
        Roles[Role Assignments]
        Perms[Permission Assignments]
    end

    subgraph "Permission System Core"
        PSC[Permission Service]
        PMC[Permission Middleware]
        PE[Permission Evaluator]
        CC[Conditional Checker]
    end

    subgraph "Database Layer"
        DB[(Database)]
        Users[Users Table]
        RolesT[Roles Table]
        PermsT[Permissions Table]
        RolePerms[Role_Permissions Table]
        UserRoles[User_Roles Table]
    end

    subgraph "Business Logic Layer"
        Controllers[Controllers]
        Services[Business Services]
        Middleware[Express Middleware]
    end

    subgraph "Permission Categories"
        VM[Vendor Management]
        PM[Product Management]
        EM[Earnings & Payment]
        FM[Feedback & Support]
        NM[Notification Panel]
        UM[User Management]
        AR[Analytics & Reports]
        SA[System Administration]
    end

    User --> PMC
    PMC --> PSC
    PSC --> PE
    PE --> CC
    PE --> DB
    CC --> VM
    CC --> PM
    CC --> EM
    CC --> FM
    CC --> NM
    CC --> UM
    CC --> AR
    CC --> SA
    
    DB --> Users
    DB --> RolesT
    DB --> PermsT
    DB --> RolePerms
    DB --> UserRoles
    
    Controllers --> PMC
    Services --> PSC
    Middleware --> PMC

    style User fill:#e1f5fe
    style PMC fill:#f3e5f5
    style PSC fill:#e8f5e8
    style DB fill:#fff3e0