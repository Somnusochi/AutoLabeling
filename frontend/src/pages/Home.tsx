import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { CategoryInput } from "@/components/CategoryInput";
import { DetectionResult } from "@/components/DetectionResult";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { TrainingPanel } from "@/components/TrainingPanel";
import { VideoPanel } from "@/components/VideoPanel";
import { VideoValidator } from "@/components/VideoValidator";
import { DetectionSkeleton, HistorySkeleton } from "@/components/LoadingSkeleton";
import { ValidationSettings } from "@/components/ValidationSettings";
import { FilterPanel } from "@/components/FilterPanel";

export function Home() {
  const { t, i18n } = useTranslation();
  const {
    appMode,
    setAppMode,
    validateModelSource,
    setValidateModelSource,
    selectedTrainedJobId,
    setSelectedTrainedJobId,
    inputMode,
    setInputMode,
    files,
    setFiles,
    previewUrl,
    setPreviewUrl,
    categories,
    setCategories,
    validateVideoId,
    setValidateVideoId,
    validateRunKey,
    setValidateRunKey,
    externalModelFile,
    setExternalModelFile,
    result,
    setResult,
    batchResults,
    setBatchResults,
    batchProgress,
    validateConf,
    setValidateConf,
    validateIou,
    setValidateIou,
    canvasMode,
    setCanvasMode,
    drawCategory,
    setDrawCategory,
    hiddenIndices,
    filterMode,
    setFilterMode,
    nmsIou,
    setNmsIou,
    elapsedMs,
    historyData,
    recentCategories,
    handleFiles,
    handleDetect,
    handleSelectHistory,
    handleReDetect,
    handleDrawBox,
    handleDeleteBox,
    handleSelectKeyframe,
    handleBatchSelect,
    loading,
    displayResult,
    toggleBoxVisibility,
    handleSaveBoxes,
    cancelBatch,
    setHiddenIndices,
  } = useHomeState();

  return (
    <>
      <aside
        className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
        style={{ width: 420, padding: '1rem' }}>
        
        {/* Language & App Title */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-gray-400 tracking-wider">LOCATEANYTHING</span>
          <button
            onClick={() => i18n.changeLanguage(i18n.language.startsWith("zh") ? "en" : "zh")}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-primary-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-2 py-0.5 transition-colors cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            {i18n.language.startsWith("zh") ? "English" : "中文"}
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 mb-2">
          {(['annotate', 'validate'] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                setAppMode(m)
                setResult(null)
                setValidateVideoId(null)
              }}
              className={`flex-1 pb-3 pt-1 text-sm font-bold transition-all duration-200 relative text-center cursor-pointer ${
                appMode === m
                  ? 'text-primary-600 border-b-2 border-primary-600 scale-[1.02]'
                  : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'
              }`}>
              {{ annotate: t("common.annotate"), validate: t("common.validate") }[m]}
            </button>
          ))}
        </div>

        {appMode === 'validate' && (
          <ValidationSettings
            selectedJobId={selectedTrainedJobId}
            onSelectJob={setSelectedTrainedJobId}
            modelSource={validateModelSource}
            onSourceChange={setValidateModelSource}
            externalFile={externalModelFile}
            onExternalFile={setExternalModelFile}
            validateConf={validateConf}
            onConfChange={setValidateConf}
            validateIou={validateIou}
            onIouChange={setValidateIou}
          />
        )}

        <div>
          <div className="flex gap-1 rounded bg-gray-100 p-0.5 mb-2">
            {(['image', 'video'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setInputMode(mode)
                  setFiles([])
                  setPreviewUrl(null)
                  setBatchResults([])
                }}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  inputMode === mode
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {{ image: t("common.image"), video: t("common.video") }[mode]}
              </button>
            ))}
          </div>
          {inputMode === 'image' ? (
            <ImageUploader onFiles={handleFiles} disabled={loading} />
          ) : (
            <VideoPanel
              onLoadKeyframes={handleSelectKeyframe}
              onValidateVideo={
                appMode === 'validate'
                  ? videoId => {
                      setValidateVideoId(videoId)
                      setValidateRunKey(k => k + 1)
                    }
                  : undefined
              }
              disabled={loading}
            />
          )}
        </div>

        {!(
          appMode === 'validate' &&
          inputMode === 'video' &&
          validateVideoId
        ) && (
          <>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">{t("common.categories")}</p>
              <CategoryInput
                categories={categories}
                onChange={setCategories}
                disabled={loading}
                recentCategories={recentCategories}
              />
            </div>

            <button
              type="button"
              disabled={
                loading ||
                files.length === 0 ||
                (appMode !== 'validate' && categories.length === 0)
              }
              onClick={handleDetect}
              className="w-full rounded bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {batchProgress.total > 1
                    ? t("home.detectingCount", { current: batchProgress.current, total: batchProgress.total })
                    : t("home.detectingDefault")}
                </span>
              ) : appMode === 'validate' ? (
                t("home.yoloValidation")
              ) : files.length > 1 ? (
                t("home.detectBtnImageCount", { count: files.length })
              ) : (
                t("home.detectBtnImage")
              )}
            </button>
          </>
        )}

        {appMode === 'validate' && inputMode === 'video' && (
          <div className="text-xs text-gray-400 text-center py-2">
            {validateVideoId
              ? t("home.placeholderVideoRunning")
              : t("home.placeholderSelectVideo")}
          </div>
        )}

        <BatchProgress
          current={batchProgress.current}
          total={batchProgress.total}
          completed={batchResults.length}
          onCancel={cancelBatch}
        />

        {result && (
          <FilterPanel
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            nmsIou={nmsIou}
            onNmsIouChange={setNmsIou}
            setHiddenIndices={setHiddenIndices}
          />
        )}

        <hr className="border-gray-100" />

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{t("common.history")}</p>
          <Suspense fallback={<HistorySkeleton />}>
            <ErrorBoundary>
              <HistoryList data={historyData} onSelect={handleSelectHistory} />
            </ErrorBoundary>
          </Suspense>
        </div>

        <hr className="border-gray-100" />

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{t("common.yoloTrain")}</p>
          <TrainingPanel detections={historyData?.items ?? []} />
        </div>
      </aside>

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
        {loading && !result && <DetectionSkeleton />}
        {displayResult && previewUrl && (
          <ErrorBoundary>
            <DetectionResult
              result={displayResult}
              previewUrl={previewUrl}
              batchResults={batchResults}
              batchFiles={files}
              loading={loading}
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
  )
}
