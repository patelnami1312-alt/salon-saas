-- ============================================================
-- SALON MANAGEMENT SAAS PLATFORM - SQL SERVER SCHEMA
-- Version: 1.0.0
-- Database: Microsoft SQL Server 2022
-- ============================================================

USE SalonSaaS;
GO

-- ============================================================
-- SECTION 1: SUPER ADMIN / SUBSCRIPTION
-- ============================================================

CREATE TABLE SubscriptionPlans (
    PlanID          INT IDENTITY(1,1) PRIMARY KEY,
    PlanName        NVARCHAR(100) NOT NULL,
    Price           DECIMAL(10,2) NOT NULL DEFAULT 0,
    BillingCycle    NVARCHAR(20)  NOT NULL DEFAULT 'Monthly', -- Monthly, Yearly
    MaxBranches     INT           NOT NULL DEFAULT 1,
    MaxStaff        INT           NOT NULL DEFAULT 10,
    MaxCustomers    INT           NOT NULL DEFAULT 1000,
    Features        NVARCHAR(MAX),                             -- JSON array
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Salons (
    SalonID             INT IDENTITY(1,1) PRIMARY KEY,
    SalonName           NVARCHAR(200) NOT NULL,
    OwnerName           NVARCHAR(200),
    Email               NVARCHAR(200) UNIQUE NOT NULL,
    Phone               NVARCHAR(20),
    Address             NVARCHAR(500),
    LogoURL             NVARCHAR(500),
    Currency            NVARCHAR(10)  NOT NULL DEFAULT 'INR',
    Timezone            NVARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    SubscriptionPlanID  INT FOREIGN KEY REFERENCES SubscriptionPlans(PlanID),
    SubscriptionStatus  NVARCHAR(50)  NOT NULL DEFAULT 'Trial',  -- Trial, Active, Expired, Suspended
    TrialExpiryDate     DATETIME2,
    IsActive            BIT           NOT NULL DEFAULT 1,
    Settings            NVARCHAR(MAX),                            -- JSON settings
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE SalonSubscriptions (
    SubscriptionID  INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    PlanID          INT           NOT NULL FOREIGN KEY REFERENCES SubscriptionPlans(PlanID),
    StartDate       DATE          NOT NULL,
    EndDate         DATE          NOT NULL,
    Amount          DECIMAL(10,2) NOT NULL,
    TransactionRef  NVARCHAR(200),
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Active',  -- Active, Expired, Cancelled
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 2: BRANCHES
-- ============================================================

CREATE TABLE Branches (
    BranchID        INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    BranchName      NVARCHAR(200) NOT NULL,
    BranchCode      NVARCHAR(20)  UNIQUE,
    Phone           NVARCHAR(20),
    Email           NVARCHAR(200),
    Address         NVARCHAR(500),
    City            NVARCHAR(100),
    State           NVARCHAR(100),
    PostalCode      NVARCHAR(20),
    Country         NVARCHAR(100) DEFAULT 'India',
    Latitude        DECIMAL(10,8),
    Longitude       DECIMAL(11,8),
    OpeningTime     TIME,
    ClosingTime     TIME,
    WorkingDays     NVARCHAR(100) DEFAULT '1,2,3,4,5,6',   -- Comma-separated day numbers
    SlotDuration    INT           NOT NULL DEFAULT 30,       -- minutes
    MaxAdvanceBookingDays INT     NOT NULL DEFAULT 30,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 3: ROLES & PERMISSIONS
-- ============================================================

CREATE TABLE Roles (
    RoleID      INT IDENTITY(1,1) PRIMARY KEY,
    RoleName    NVARCHAR(50)  NOT NULL UNIQUE,
    RoleCode    NVARCHAR(30)  NOT NULL UNIQUE,   -- SUPER_ADMIN, SALON_OWNER, etc.
    Description NVARCHAR(200),
    IsSystem    BIT           NOT NULL DEFAULT 0,
    CreatedAt   DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Permissions (
    PermissionID    INT IDENTITY(1,1) PRIMARY KEY,
    PermissionName  NVARCHAR(100) NOT NULL UNIQUE,
    Module          NVARCHAR(50)  NOT NULL,
    Action          NVARCHAR(50)  NOT NULL,
    Description     NVARCHAR(200),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE RolePermissions (
    RoleID          INT NOT NULL FOREIGN KEY REFERENCES Roles(RoleID),
    PermissionID    INT NOT NULL FOREIGN KEY REFERENCES Permissions(PermissionID),
    PRIMARY KEY (RoleID, PermissionID)
);

-- ============================================================
-- SECTION 4: USERS (all roles except Customer)
-- ============================================================

CREATE TABLE Users (
    UserID                  INT IDENTITY(1,1) PRIMARY KEY,
    SalonID                 INT           FOREIGN KEY REFERENCES Salons(SalonID),
    BranchID                INT           FOREIGN KEY REFERENCES Branches(BranchID),
    RoleID                  INT           NOT NULL FOREIGN KEY REFERENCES Roles(RoleID),
    FirstName               NVARCHAR(100) NOT NULL,
    LastName                NVARCHAR(100) NOT NULL,
    Email                   NVARCHAR(200) UNIQUE NOT NULL,
    Phone                   NVARCHAR(20),
    PasswordHash            NVARCHAR(255) NOT NULL,
    ProfilePictureURL       NVARCHAR(500),
    IsActive                BIT           NOT NULL DEFAULT 1,
    IsEmailVerified         BIT           NOT NULL DEFAULT 0,
    EmailVerificationToken  NVARCHAR(255),
    EmailTokenExpiry        DATETIME2,
    ResetPasswordToken      NVARCHAR(255),
    ResetPasswordExpiry     DATETIME2,
    OTPCode                 NVARCHAR(10),
    OTPExpiry               DATETIME2,
    LastLoginAt             DATETIME2,
    FailedLoginAttempts     INT           NOT NULL DEFAULT 0,
    LockedUntil             DATETIME2,
    CreatedAt               DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt               DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_SalonID ON Users(SalonID);
CREATE INDEX IX_Users_BranchID ON Users(BranchID);

CREATE TABLE RefreshTokens (
    TokenID     INT IDENTITY(1,1) PRIMARY KEY,
    UserID      INT           NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
    Token       NVARCHAR(500) NOT NULL,
    ExpiresAt   DATETIME2     NOT NULL,
    IsRevoked   BIT           NOT NULL DEFAULT 0,
    DeviceInfo  NVARCHAR(500),
    IPAddress   NVARCHAR(50),
    CreatedAt   DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 5: CUSTOMERS
-- ============================================================

CREATE TABLE Customers (
    CustomerID          INT IDENTITY(1,1) PRIMARY KEY,
    SalonID             INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    FirstName           NVARCHAR(100) NOT NULL,
    LastName            NVARCHAR(100) NOT NULL,
    Gender              NVARCHAR(20),                        -- Male, Female, Other, Prefer not to say
    DateOfBirth         DATE,
    Mobile              NVARCHAR(20)  NOT NULL,
    Email               NVARCHAR(200),
    Address             NVARCHAR(500),
    City                NVARCHAR(100),
    ProfilePictureURL   NVARCHAR(500),
    Notes               NVARCHAR(MAX),
    Preferences         NVARCHAR(MAX),                       -- JSON: preferred staff, services, etc.
    LoyaltyPoints       INT           NOT NULL DEFAULT 0,
    WalletBalance       DECIMAL(10,2) NOT NULL DEFAULT 0,
    ReferralCode        NVARCHAR(50)  UNIQUE,
    ReferredByID        INT           FOREIGN KEY REFERENCES Customers(CustomerID),
    TotalVisits         INT           NOT NULL DEFAULT 0,
    TotalSpent          DECIMAL(10,2) NOT NULL DEFAULT 0,
    LastVisitDate       DATE,
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Customers_Mobile ON Customers(Mobile);
CREATE INDEX IX_Customers_SalonID ON Customers(SalonID);
CREATE INDEX IX_Customers_Email ON Customers(Email);
CREATE INDEX IX_Customers_ReferralCode ON Customers(ReferralCode);

CREATE TABLE CustomerAuth (
    AuthID          INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    PasswordHash    NVARCHAR(255) NOT NULL,
    IsEmailVerified BIT           NOT NULL DEFAULT 0,
    OTPCode         NVARCHAR(10),
    OTPExpiry       DATETIME2,
    LastLoginAt     DATETIME2,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE MembershipPlans (
    PlanID          INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    PlanName        NVARCHAR(200) NOT NULL,
    Description     NVARCHAR(MAX),
    Price           DECIMAL(10,2) NOT NULL,
    DurationDays    INT           NOT NULL DEFAULT 30,
    DiscountPercent DECIMAL(5,2)  NOT NULL DEFAULT 0,
    LoyaltyBonus    INT           NOT NULL DEFAULT 0,
    Benefits        NVARCHAR(MAX),                           -- JSON array of benefit strings
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE CustomerMemberships (
    MembershipID    INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    PlanID          INT           NOT NULL FOREIGN KEY REFERENCES MembershipPlans(PlanID),
    StartDate       DATE          NOT NULL,
    EndDate         DATE          NOT NULL,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Active', -- Active, Expired, Cancelled
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE CustomerReviews (
    ReviewID        INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    BranchID        INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    AppointmentID   INT,
    StaffID         INT,
    Rating          INT           NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    Review          NVARCHAR(MAX),
    IsPublic        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE LoyaltyTransactions (
    TransactionID   INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    InvoiceID       INT,
    Points          INT           NOT NULL,
    TransactionType NVARCHAR(50)  NOT NULL,  -- Earned, Redeemed, Expired, Bonus, Referral
    Description     NVARCHAR(500),
    BalanceAfter    INT           NOT NULL,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE WalletTransactions (
    TransactionID   INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    Amount          DECIMAL(10,2) NOT NULL,
    TransactionType NVARCHAR(50)  NOT NULL, -- Credit, Debit, Refund
    Description     NVARCHAR(500),
    BalanceAfter    DECIMAL(10,2) NOT NULL,
    InvoiceID       INT,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 6: STAFF
-- ============================================================

CREATE TABLE Staff (
    StaffID             INT IDENTITY(1,1) PRIMARY KEY,
    UserID              INT           NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    BranchID            INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    SalonID             INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    StaffCode           NVARCHAR(50)  UNIQUE,
    JobTitle            NVARCHAR(100),
    Skills              NVARCHAR(MAX),                       -- JSON array of skill strings
    Experience          INT           NOT NULL DEFAULT 0,    -- years
    Salary              DECIMAL(10,2) NOT NULL DEFAULT 0,
    CommissionPercent   DECIMAL(5,2)  NOT NULL DEFAULT 0,
    JoiningDate         DATE,
    Gender              NVARCHAR(20),
    IsActive            BIT           NOT NULL DEFAULT 1,
    TotalServiced       INT           NOT NULL DEFAULT 0,
    AverageRating       DECIMAL(3,2)  NOT NULL DEFAULT 0,
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE StaffSchedules (
    ScheduleID  INT IDENTITY(1,1) PRIMARY KEY,
    StaffID     INT     NOT NULL FOREIGN KEY REFERENCES Staff(StaffID),
    DayOfWeek   INT     NOT NULL CHECK (DayOfWeek BETWEEN 0 AND 6), -- 0=Sun,6=Sat
    StartTime   TIME    NOT NULL,
    EndTime     TIME    NOT NULL,
    IsWorking   BIT     NOT NULL DEFAULT 1,
    BreakStart  TIME,
    BreakEnd    TIME
);

CREATE TABLE StaffAttendance (
    AttendanceID    INT IDENTITY(1,1) PRIMARY KEY,
    StaffID         INT           NOT NULL FOREIGN KEY REFERENCES Staff(StaffID),
    AttendanceDate  DATE          NOT NULL,
    CheckInTime     DATETIME2,
    CheckOutTime    DATETIME2,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Present', -- Present, Absent, Late, HalfDay, Leave
    Notes           NVARCHAR(500),
    MarkedByUserID  INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UNIQUE (StaffID, AttendanceDate)
);

CREATE TABLE Leaves (
    LeaveID             INT IDENTITY(1,1) PRIMARY KEY,
    StaffID             INT           NOT NULL FOREIGN KEY REFERENCES Staff(StaffID),
    LeaveType           NVARCHAR(50)  NOT NULL, -- Sick, Casual, Annual, Unpaid
    FromDate            DATE          NOT NULL,
    ToDate              DATE          NOT NULL,
    TotalDays           DECIMAL(4,1),
    Reason              NVARCHAR(500),
    Status              NVARCHAR(50)  NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    ApprovedByUserID    INT           FOREIGN KEY REFERENCES Users(UserID),
    ApprovedAt          DATETIME2,
    RejectionReason     NVARCHAR(500),
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Commissions (
    CommissionID        INT IDENTITY(1,1) PRIMARY KEY,
    StaffID             INT           NOT NULL FOREIGN KEY REFERENCES Staff(StaffID),
    InvoiceID           INT           NOT NULL,
    InvoiceItemID       INT,
    BaseAmount          DECIMAL(10,2) NOT NULL,
    CommissionPercent   DECIMAL(5,2)  NOT NULL,
    Amount              DECIMAL(10,2) NOT NULL,
    Status              NVARCHAR(50)  NOT NULL DEFAULT 'Pending', -- Pending, Paid
    PayrollID           INT,
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Payroll (
    PayrollID           INT IDENTITY(1,1) PRIMARY KEY,
    StaffID             INT           NOT NULL FOREIGN KEY REFERENCES Staff(StaffID),
    PayPeriodStart      DATE          NOT NULL,
    PayPeriodEnd        DATE          NOT NULL,
    BaseSalary          DECIMAL(10,2) NOT NULL DEFAULT 0,
    TotalCommission     DECIMAL(10,2) NOT NULL DEFAULT 0,
    Bonus               DECIMAL(10,2) NOT NULL DEFAULT 0,
    TotalDeductions     DECIMAL(10,2) NOT NULL DEFAULT 0,
    NetPay              DECIMAL(10,2) NOT NULL,
    WorkingDays         INT,
    PresentDays         INT,
    Status              NVARCHAR(50)  NOT NULL DEFAULT 'Pending', -- Pending, Processed, Paid
    ProcessedByUserID   INT           FOREIGN KEY REFERENCES Users(UserID),
    ProcessedAt         DATETIME2,
    Notes               NVARCHAR(MAX),
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 7: SERVICES
-- ============================================================

CREATE TABLE ServiceCategories (
    CategoryID      INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    CategoryName    NVARCHAR(100) NOT NULL,
    Description     NVARCHAR(500),
    IconURL         NVARCHAR(500),
    ColorCode       NVARCHAR(20),
    SortOrder       INT           NOT NULL DEFAULT 0,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Services (
    ServiceID       INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    CategoryID      INT           NOT NULL FOREIGN KEY REFERENCES ServiceCategories(CategoryID),
    ServiceName     NVARCHAR(200) NOT NULL,
    Description     NVARCHAR(MAX),
    Duration        INT           NOT NULL,                  -- minutes
    Price           DECIMAL(10,2) NOT NULL,
    TaxPercent      DECIMAL(5,2)  NOT NULL DEFAULT 0,
    GenderType      NVARCHAR(20)  NOT NULL DEFAULT 'Unisex', -- Male, Female, Unisex
    ImageURL        NVARCHAR(500),
    ColorCode       NVARCHAR(20),
    SortOrder       INT           NOT NULL DEFAULT 0,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Services_SalonID ON Services(SalonID);
CREATE INDEX IX_Services_CategoryID ON Services(CategoryID);

CREATE TABLE ServiceAddons (
    AddonID     INT IDENTITY(1,1) PRIMARY KEY,
    ServiceID   INT           NOT NULL FOREIGN KEY REFERENCES Services(ServiceID),
    AddonName   NVARCHAR(200) NOT NULL,
    Price       DECIMAL(10,2) NOT NULL,
    Duration    INT           NOT NULL DEFAULT 0,
    IsActive    BIT           NOT NULL DEFAULT 1
);

CREATE TABLE StaffServices (
    StaffID     INT NOT NULL FOREIGN KEY REFERENCES Staff(StaffID),
    ServiceID   INT NOT NULL FOREIGN KEY REFERENCES Services(ServiceID),
    PRIMARY KEY (StaffID, ServiceID)
);

CREATE TABLE ServicePackages (
    PackageID       INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    PackageName     NVARCHAR(200) NOT NULL,
    Description     NVARCHAR(MAX),
    OriginalPrice   DECIMAL(10,2) NOT NULL,
    PackagePrice    DECIMAL(10,2) NOT NULL,
    ValidityDays    INT           NOT NULL DEFAULT 30,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE PackageServices (
    PackageID   INT NOT NULL FOREIGN KEY REFERENCES ServicePackages(PackageID),
    ServiceID   INT NOT NULL FOREIGN KEY REFERENCES Services(ServiceID),
    Quantity    INT NOT NULL DEFAULT 1,
    PRIMARY KEY (PackageID, ServiceID)
);

-- ============================================================
-- SECTION 8: APPOINTMENTS
-- ============================================================

CREATE TABLE Appointments (
    AppointmentID       INT IDENTITY(1,1) PRIMARY KEY,
    SalonID             INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    BranchID            INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    CustomerID          INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    StaffID             INT           FOREIGN KEY REFERENCES Staff(StaffID),
    ServiceID           INT           NOT NULL FOREIGN KEY REFERENCES Services(ServiceID),
    AppointmentDate     DATE          NOT NULL,
    StartTime           TIME          NOT NULL,
    EndTime             TIME          NOT NULL,
    Status              NVARCHAR(50)  NOT NULL DEFAULT 'Scheduled',
    -- Scheduled, Confirmed, CheckedIn, InService, Completed, Cancelled, NoShow
    Notes               NVARCHAR(MAX),
    CancellationReason  NVARCHAR(500),
    RescheduledFromID   INT           FOREIGN KEY REFERENCES Appointments(AppointmentID),
    BookingSource       NVARCHAR(50)  NOT NULL DEFAULT 'Online', -- Online, WalkIn, Phone, Staff
    ServiceAmount       DECIMAL(10,2),
    ReminderSent        BIT           NOT NULL DEFAULT 0,
    Reminder24hSent     BIT           NOT NULL DEFAULT 0,
    Reminder1hSent      BIT           NOT NULL DEFAULT 0,
    CreatedByUserID     INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Appointments_BranchID_Date ON Appointments(BranchID, AppointmentDate);
CREATE INDEX IX_Appointments_CustomerID ON Appointments(CustomerID);
CREATE INDEX IX_Appointments_StaffID ON Appointments(StaffID);
CREATE INDEX IX_Appointments_Status ON Appointments(Status);

CREATE TABLE AppointmentAddons (
    ID              INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentID   INT           NOT NULL FOREIGN KEY REFERENCES Appointments(AppointmentID),
    AddonID         INT           NOT NULL FOREIGN KEY REFERENCES ServiceAddons(AddonID),
    Price           DECIMAL(10,2) NOT NULL
);

CREATE TABLE Waitlist (
    WaitlistID      INT IDENTITY(1,1) PRIMARY KEY,
    BranchID        INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    ServiceID       INT           NOT NULL FOREIGN KEY REFERENCES Services(ServiceID),
    StaffID         INT           FOREIGN KEY REFERENCES Staff(StaffID),
    PreferredDate   DATE,
    PreferredTime   TIME,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Waiting', -- Waiting, Booked, Expired, Cancelled
    Notes           NVARCHAR(500),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 9: CHECK-IN / QUEUE
-- ============================================================

CREATE TABLE CheckIns (
    CheckInID       INT IDENTITY(1,1) PRIMARY KEY,
    BranchID        INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    AppointmentID   INT           FOREIGN KEY REFERENCES Appointments(AppointmentID),
    StaffID         INT           FOREIGN KEY REFERENCES Staff(StaffID),
    ServiceID       INT           NOT NULL FOREIGN KEY REFERENCES Services(ServiceID),
    QueueNumber     INT,
    CheckInTime     DATETIME2     NOT NULL DEFAULT GETDATE(),
    StartServiceTime DATETIME2,
    EndServiceTime  DATETIME2,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Waiting',
    -- Waiting, CheckedIn, InService, Completed, Cancelled
    Notes           NVARCHAR(500),
    CreatedByUserID INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_CheckIns_BranchID_Status ON CheckIns(BranchID, Status);

-- ============================================================
-- SECTION 10: BILLING / POS
-- ============================================================

CREATE TABLE Coupons (
    CouponID        INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    CouponCode      NVARCHAR(50)  UNIQUE NOT NULL,
    Description     NVARCHAR(200),
    DiscountType    NVARCHAR(20)  NOT NULL, -- Percent, Fixed
    DiscountValue   DECIMAL(10,2) NOT NULL,
    MinOrderAmount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    MaxDiscount     DECIMAL(10,2),
    MaxUses         INT,
    UsedCount       INT           NOT NULL DEFAULT 0,
    ValidFrom       DATETIME2,
    ValidUntil      DATETIME2,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Invoices (
    InvoiceID       INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceNumber   NVARCHAR(50)  UNIQUE NOT NULL,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    BranchID        INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    AppointmentID   INT           FOREIGN KEY REFERENCES Appointments(AppointmentID),
    CheckInID       INT           FOREIGN KEY REFERENCES CheckIns(CheckInID),
    SubTotal        DECIMAL(10,2) NOT NULL,
    TaxAmount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    DiscountAmount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    CouponID        INT           FOREIGN KEY REFERENCES Coupons(CouponID),
    WalletUsed      DECIMAL(10,2) NOT NULL DEFAULT 0,
    LoyaltyUsed     INT           NOT NULL DEFAULT 0,        -- points used
    TotalAmount     DECIMAL(10,2) NOT NULL,
    PaidAmount      DECIMAL(10,2) NOT NULL DEFAULT 0,
    BalanceAmount   DECIMAL(10,2) NOT NULL DEFAULT 0,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Pending', -- Pending, Paid, PartiallyPaid, Refunded, Cancelled
    Notes           NVARCHAR(500),
    PrintedCount    INT           NOT NULL DEFAULT 0,
    CreatedByUserID INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Invoices_BranchID ON Invoices(BranchID);
CREATE INDEX IX_Invoices_CustomerID ON Invoices(CustomerID);
CREATE INDEX IX_Invoices_CreatedAt ON Invoices(CreatedAt);

CREATE TABLE InvoiceItems (
    ItemID          INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceID       INT           NOT NULL FOREIGN KEY REFERENCES Invoices(InvoiceID),
    ItemType        NVARCHAR(50)  NOT NULL, -- Service, Product, Package, Addon
    ItemRefID       INT,
    ItemName        NVARCHAR(200) NOT NULL,
    Quantity        INT           NOT NULL DEFAULT 1,
    UnitPrice       DECIMAL(10,2) NOT NULL,
    TaxPercent      DECIMAL(5,2)  NOT NULL DEFAULT 0,
    TaxAmount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    DiscountPercent DECIMAL(5,2)  NOT NULL DEFAULT 0,
    DiscountAmount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    TotalPrice      DECIMAL(10,2) NOT NULL,
    StaffID         INT           FOREIGN KEY REFERENCES Staff(StaffID)
);

CREATE TABLE Payments (
    PaymentID       INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceID       INT           NOT NULL FOREIGN KEY REFERENCES Invoices(InvoiceID),
    CustomerID      INT           NOT NULL FOREIGN KEY REFERENCES Customers(CustomerID),
    PaymentMethod   NVARCHAR(50)  NOT NULL, -- Cash, Card, Wallet, UPI, Online, Split
    Amount          DECIMAL(10,2) NOT NULL,
    TransactionID   NVARCHAR(200),
    GatewayResponse NVARCHAR(MAX),
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Success', -- Success, Failed, Pending, Refunded
    Notes           NVARCHAR(500),
    RefundedAmount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    RefundedAt      DATETIME2,
    CreatedByUserID INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 11: INVENTORY
-- ============================================================

CREATE TABLE Suppliers (
    SupplierID      INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    SupplierName    NVARCHAR(200) NOT NULL,
    ContactPerson   NVARCHAR(200),
    Email           NVARCHAR(200),
    Phone           NVARCHAR(20),
    Address         NVARCHAR(500),
    GSTIN           NVARCHAR(50),
    PaymentTerms    NVARCHAR(200),
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE ProductCategories (
    CategoryID      INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    CategoryName    NVARCHAR(100) NOT NULL,
    Description     NVARCHAR(500),
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Products (
    ProductID       INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    CategoryID      INT           NOT NULL FOREIGN KEY REFERENCES ProductCategories(CategoryID),
    SupplierID      INT           FOREIGN KEY REFERENCES Suppliers(SupplierID),
    ProductName     NVARCHAR(200) NOT NULL,
    SKU             NVARCHAR(100) UNIQUE,
    Barcode         NVARCHAR(100),
    Description     NVARCHAR(MAX),
    CostPrice       DECIMAL(10,2) NOT NULL DEFAULT 0,
    SalePrice       DECIMAL(10,2) NOT NULL DEFAULT 0,
    TaxPercent      DECIMAL(5,2)  NOT NULL DEFAULT 0,
    Unit            NVARCHAR(50),
    HSNCode         NVARCHAR(20),
    ImageURL        NVARCHAR(500),
    IsForSale       BIT           NOT NULL DEFAULT 1,
    IsForUse        BIT           NOT NULL DEFAULT 1,  -- used in salon services
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Inventory (
    InventoryID         INT IDENTITY(1,1) PRIMARY KEY,
    ProductID           INT           NOT NULL FOREIGN KEY REFERENCES Products(ProductID),
    BranchID            INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    CurrentStock        DECIMAL(10,2) NOT NULL DEFAULT 0,
    MinStockLevel       DECIMAL(10,2) NOT NULL DEFAULT 0,
    MaxStockLevel       DECIMAL(10,2),
    ReorderPoint        DECIMAL(10,2) NOT NULL DEFAULT 0,
    LastRestockedAt     DATETIME2,
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UNIQUE (ProductID, BranchID)
);

CREATE TABLE PurchaseOrders (
    POID            INT IDENTITY(1,1) PRIMARY KEY,
    PONumber        NVARCHAR(50)  UNIQUE NOT NULL,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    BranchID        INT           NOT NULL FOREIGN KEY REFERENCES Branches(BranchID),
    SupplierID      INT           NOT NULL FOREIGN KEY REFERENCES Suppliers(SupplierID),
    OrderDate       DATE          NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    ExpectedDate    DATE,
    ReceivedDate    DATE,
    SubTotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
    TaxAmount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    TotalAmount     DECIMAL(10,2) NOT NULL DEFAULT 0,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Draft', -- Draft, Ordered, PartiallyReceived, Received, Cancelled
    Notes           NVARCHAR(MAX),
    CreatedByUserID INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE PurchaseOrderItems (
    ItemID              INT IDENTITY(1,1) PRIMARY KEY,
    POID                INT           NOT NULL FOREIGN KEY REFERENCES PurchaseOrders(POID),
    ProductID           INT           NOT NULL FOREIGN KEY REFERENCES Products(ProductID),
    OrderedQuantity     DECIMAL(10,2) NOT NULL,
    ReceivedQuantity    DECIMAL(10,2) NOT NULL DEFAULT 0,
    UnitPrice           DECIMAL(10,2) NOT NULL,
    TaxPercent          DECIMAL(5,2)  NOT NULL DEFAULT 0,
    TotalPrice          DECIMAL(10,2) NOT NULL
);

CREATE TABLE StockTransactions (
    TransactionID   INT IDENTITY(1,1) PRIMARY KEY,
    InventoryID     INT           NOT NULL FOREIGN KEY REFERENCES Inventory(InventoryID),
    TransactionType NVARCHAR(50)  NOT NULL, -- Purchase, Sale, Adjustment, Return, Transfer, Use
    Quantity        DECIMAL(10,2) NOT NULL,
    BalanceBefore   DECIMAL(10,2) NOT NULL,
    BalanceAfter    DECIMAL(10,2) NOT NULL,
    Notes           NVARCHAR(500),
    POID            INT           FOREIGN KEY REFERENCES PurchaseOrders(POID),
    InvoiceID       INT           FOREIGN KEY REFERENCES Invoices(InvoiceID),
    CreatedByUserID INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 12: NOTIFICATIONS & CAMPAIGNS
-- ============================================================

CREATE TABLE NotificationTemplates (
    TemplateID      INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           FOREIGN KEY REFERENCES Salons(SalonID),  -- NULL = system template
    TemplateName    NVARCHAR(200) NOT NULL,
    Type            NVARCHAR(50)  NOT NULL, -- SMS, Email, WhatsApp, Push
    Event           NVARCHAR(100),          -- AppointmentReminder, BookingConfirm, etc.
    Subject         NVARCHAR(500),
    Body            NVARCHAR(MAX) NOT NULL, -- supports {{customer_name}}, {{appointment_time}} etc.
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Notifications (
    NotificationID  INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    RecipientType   NVARCHAR(50)  NOT NULL, -- Customer, Staff, User
    RecipientID     INT           NOT NULL,
    Type            NVARCHAR(50)  NOT NULL, -- SMS, Email, Push, WhatsApp
    Subject         NVARCHAR(500),
    Message         NVARCHAR(MAX) NOT NULL,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Pending', -- Pending, Sent, Failed
    SentAt          DATETIME2,
    ErrorMessage    NVARCHAR(1000),
    RetryCount      INT           NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Notifications_Status ON Notifications(Status, CreatedAt);

CREATE TABLE Campaigns (
    CampaignID      INT IDENTITY(1,1) PRIMARY KEY,
    SalonID         INT           NOT NULL FOREIGN KEY REFERENCES Salons(SalonID),
    CampaignName    NVARCHAR(200) NOT NULL,
    Type            NVARCHAR(50)  NOT NULL, -- SMS, Email, WhatsApp, Push
    Subject         NVARCHAR(500),
    Message         NVARCHAR(MAX) NOT NULL,
    TargetAudience  NVARCHAR(100) NOT NULL DEFAULT 'All',
    -- All, NewCustomers, RegularCustomers, InactiveCustomers, MembershipCustomers, BirthdayToday
    FiltersJSON     NVARCHAR(MAX),
    ScheduledAt     DATETIME2,
    Status          NVARCHAR(50)  NOT NULL DEFAULT 'Draft', -- Draft, Scheduled, Running, Sent, Cancelled
    TotalRecipients INT           NOT NULL DEFAULT 0,
    SentCount       INT           NOT NULL DEFAULT 0,
    FailedCount     INT           NOT NULL DEFAULT 0,
    CreatedByUserID INT           FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt       DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- SECTION 13: AUDIT LOGS
-- ============================================================

CREATE TABLE AuditLogs (
    LogID       INT IDENTITY(1,1) PRIMARY KEY,
    SalonID     INT,
    UserID      INT           FOREIGN KEY REFERENCES Users(UserID),
    Action      NVARCHAR(100) NOT NULL,
    Module      NVARCHAR(100) NOT NULL,
    RecordID    INT,
    OldValues   NVARCHAR(MAX),
    NewValues   NVARCHAR(MAX),
    IPAddress   NVARCHAR(50),
    UserAgent   NVARCHAR(500),
    CreatedAt   DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_AuditLogs_SalonID_Module ON AuditLogs(SalonID, Module, CreatedAt);

-- ============================================================
-- SECTION 14: SEED DATA
-- ============================================================

-- Insert Default Roles
INSERT INTO Roles (RoleName, RoleCode, Description, IsSystem) VALUES
('Super Admin',     'SUPER_ADMIN',      'Platform super administrator',     1),
('Salon Owner',     'SALON_OWNER',      'Salon owner with full access',     1),
('Branch Manager',  'BRANCH_MANAGER',   'Branch level manager',             1),
('Receptionist',    'RECEPTIONIST',     'Front desk / check-in staff',      1),
('Staff',           'STAFF',            'Service providing staff member',   1),
('Customer',        'CUSTOMER',         'End customer',                     1);

-- Insert Default Subscription Plans
INSERT INTO SubscriptionPlans (PlanName, Price, BillingCycle, MaxBranches, MaxStaff, MaxCustomers, Features) VALUES
('Starter',     999,    'Monthly',  1,   10,  1000,   '["Appointments","POS","Basic Reports"]'),
('Professional',2499,   'Monthly',  3,   30,  5000,   '["Appointments","POS","Advanced Reports","SMS","Inventory"]'),
('Enterprise',  4999,   'Monthly',  10,  100, 50000,  '["All Features","Multi-Branch","API Access","Priority Support"]'),
('Enterprise+', 9999,   'Monthly',  100, 500, 200000, '["Unlimited","White Label","Dedicated Support"]');

-- Insert Default Permissions
INSERT INTO Permissions (PermissionName, Module, Action) VALUES
('customers.view',          'Customers',    'view'),
('customers.create',        'Customers',    'create'),
('customers.edit',          'Customers',    'edit'),
('customers.delete',        'Customers',    'delete'),
('appointments.view',       'Appointments', 'view'),
('appointments.create',     'Appointments', 'create'),
('appointments.edit',       'Appointments', 'edit'),
('appointments.cancel',     'Appointments', 'cancel'),
('staff.view',              'Staff',        'view'),
('staff.create',            'Staff',        'create'),
('staff.edit',              'Staff',        'edit'),
('staff.delete',            'Staff',        'delete'),
('billing.view',            'Billing',      'view'),
('billing.create',          'Billing',      'create'),
('billing.refund',          'Billing',      'refund'),
('inventory.view',          'Inventory',    'view'),
('inventory.manage',        'Inventory',    'manage'),
('reports.view',            'Reports',      'view'),
('reports.export',          'Reports',      'export'),
('settings.view',           'Settings',     'view'),
('settings.manage',         'Settings',     'manage');

GO
