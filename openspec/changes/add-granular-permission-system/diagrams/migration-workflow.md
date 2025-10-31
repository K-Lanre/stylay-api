# Migration Workflow Diagram

```mermaid
flowchart TD
    A[Start Migration Process] --> B[Analyze Existing Roles]
    B --> C{Validation Check}
    
    C -->|Valid| D[Generate Migration Plan]
    C -->|Invalid| E[Flag for Manual Review]
    E --> F[Admin Manual Review]
    F --> D
    
    D --> G[Preview Migration Changes]
    G --> H{Admin Approval}
    
    H -->|Approved| I[Execute Migration]
    H -->|Rejected| J[Adjust Migration Plan]
    J --> G
    
    I --> K[Validate Migration Results]
    K --> L{Validation Pass?}
    
    L -->|Pass| M[Mark Migration Complete]
    L -->|Fail| N[Rollback Migration]
    N --> O[Generate Error Report]
    O --> P[Flag for Manual Resolution]
    
    M --> Q[Update System Configuration]
    Q --> R[Enable Granular Permissions]
    R --> S[Final Validation]
    S --> T[Migration Complete]
    
    subgraph "Migration Phases"
        U[Phase 1: Foundation]
        V[Phase 2: Role Mapping]
        W[Phase 3: Migration Tools]
        X[Phase 4: Documentation]
    end
    
    I --> U
    U --> V
    V --> W
    W --> X
    
    style A fill:#e1f5fe
    style I fill:#f3e5f5
    style M fill:#e8f5e8
    style T fill:#e8f5e8
    style O fill:#ffebee
    style P fill:#fff3e0