package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// Generating mocks is handled by vektra/mockery
// 1. install go mockery https://github.com/vektra/mockery#go-install
// 2. add your method to the relevant services
// 3. from the same directory as this file run `go generate` and it will update the mock
// If you don't see any output, this most likely means your OS can't find the mockery binary
// `which mockery` to confirm and follow one of the installation methods

// DashboardService is a service for operating on dashboards.
type DashboardService interface {
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error)
	GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*models.PublicDashboardConfig, error)
	SavePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (*models.PublicDashboardConfig, error)
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error
	MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error
	BuildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error)
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) error
}

// PluginService is a service for operating on plugin dashboards.
type PluginService interface {
	GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error
}

//go:generate mockery --name DashboardProvisioningService --structname FakeDashboardProvisioning --inpackage --filename dashboard_provisioning_mock.go
// DashboardProvisioningService is a service for operating on provisioned dashboards.
type DashboardProvisioningService interface {
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveFolderForProvisionedDashboards(context.Context, *SaveDashboardDTO) (*models.Dashboard, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	UnprovisionDashboard(ctx context.Context, dashboardID int64) error
	DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error
}

//go:generate mockery --name Store --structname FakeDashboardStore --inpackage --filename database_mock.go
// Store is a dashboard store.
type Store interface {
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error)
	SavePublicDashboardConfig(cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboardConfig, error)
	GetPublicDashboardConfig(orgId int64, dashboardUid string) (*models.PublicDashboardConfig, error)
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error
	UnprovisionDashboard(ctx context.Context, id int64) error
	// GetDashboardsByPluginID retrieves dashboards identified by plugin.
	GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) error
	DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error
	FolderStore
}

//go:generate mockery --name FolderStore --structname FakeFolderStore --inpackage --filename folder_store_mock.go
// FolderStore is a folder store.
type FolderStore interface {
	// GetFolderByTitle retrieves a folder by its title
	GetFolderByTitle(ctx context.Context, orgID int64, title string) (*models.Folder, error)
	// GetFolderByUID retrieves a folder by its UID
	GetFolderByUID(ctx context.Context, orgID int64, uid string) (*models.Folder, error)
	// GetFolderByID retrieves a folder by its ID
	GetFolderByID(ctx context.Context, orgID int64, id int64) (*models.Folder, error)
}
