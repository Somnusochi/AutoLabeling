import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Sidebar } from "@/components/Sidebar";
import { VideoValidator } from "@/components/VideoValidator";
import { DetectionSkeleton } from "@/components/LoadingSkeleton";
import { DetectionResult } from "@/components/DetectionResult";

export function Home() {
  const { t } = useTranslation();
  const homeState = useHomeState();
  const {
    appMode,
    validateModelSource,
    selectedTrainedJobId,
    externalModelFile,
    validateConf,
    validateIou,
    validateVideoId,
    validateRunKey,
    result,
    loading,
    displayResult,
    previewUrl,
    batchResults,
    files,
    elapsedMs,
    categories,
    canvasMode,
    drawCategory,
    recentCategories,
    hiddenIndices,
    toggleBoxVisibility,
    setCanvasMode,
    setDrawCategory,
    handleDeleteBox,
    handleBatchSelect,
    handleReDetect,
    handleSaveBoxes,
    handleDrawBox,
  } = homeState;

  return (
    <>
      <Sidebar {...homeState} />

      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        {validateVideoId && appMode === 'validate' && (
          <VideoValidator
            key={validateRunKey}
            videoId={validateVideoId}
            jobId={
              validateModelSource === 'trained'
                ? (selectedTrainedJobId ?? undefined)
                : undefined
            }
            modelFile={
              validateModelSource === 'upload'
                ? (externalModelFile ?? undefined)
                : undefined
            }
            conf={validateConf}
            iou={validateIou}
          />
        )}

        {!validateVideoId && !result && !loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {t("home.placeholderDefault")}
          </div>
        )}
        {loading && !validateVideoId && !result && <DetectionSkeleton />}
        {displayResult && previewUrl && (
          <ErrorBoundary>
            <DetectionResult
              result={displayResult}
              previewUrl={previewUrl}
              batchResults={batchResults}
              batchFiles={files}
              loading={loading && !result}
              elapsedMs={elapsedMs}
              categories={categories}
              canvasMode={canvasMode}
              drawCategory={drawCategory}
              recentCategories={recentCategories}
              hiddenIndices={hiddenIndices}
              onToggleVisibility={toggleBoxVisibility}
              isValidation={appMode === 'validate'}
              onCanvasModeChange={setCanvasMode}
              onDrawCategoryChange={setDrawCategory}
              onDeleteBox={handleDeleteBox}
              onSelectBatch={handleBatchSelect}
              onReDetect={handleReDetect}
              onSaveBoxes={handleSaveBoxes}
              onDrawBox={handleDrawBox}
            />
          </ErrorBoundary>
        )}
      </main>
    </>
  );
}
