.onLoad <- function(libname, pkgname) {
  op <- options()
  op.ednaqc <- list(
    ednaqc.speedy_path = "/Volumes/acasis/speedy_output/edna_qc/parquet",
    ednaqc.speciesgrids_path = "/Volumes/acasis/speciesgrids/h3_7",
    ednaqc.speedy_resolution = 3
  )
  toset <- !(names(op.ednaqc) %in% names(op))
  if(any(toset)) options(op.ednaqc[toset])
  invisible()
}