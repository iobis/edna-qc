#' ednaqc
#'
#' @docType package
#' @name ednaqc
"_PACKAGE"

#' @import dplyr duckdb glue DBI stringr purrr
NULL

#' @export
evaluate_speedy <- function(observation, ...) {
  speedy_path <- getOption("ednaqc.speedy_path")
  speedy_resolution <- getOption("ednaqc.speedy_resolution")
  file_path <- file.path(speedy_path, paste0(observation$taxonID, ".parquet"))
  if (file.exists(file_path)) {
    con <- dbConnect(duckdb())
    query <- glue("
      INSTALL h3 FROM community;
      LOAD h3;
      select density, suitability from read_parquet('{file_path}')
      where h3 = h3_latlng_to_cell_string({observation$decimalLatitude}, {observation$decimalLongitude}, {speedy_resolution})
    ")
    scores <- dbGetQuery(con, query)
    return(as.list(scores))
  } else {
    return(list(suitability = NA, density = NA))
  }
}

#' @export
evaluate_speciesgrids <- function(observation, ...) {
  # TODO: add distribution to speedy output and remove this plugin
  speciesgrids_path <- getOption("ednaqc.speciesgrids_path")
  speedy_resolution <- getOption("ednaqc.speedy_resolution")
  file_path <- file.path(speciesgrids_path, "*")
  con <- dbConnect(duckdb())
  query <- glue("
    install h3 from community;
    load h3;
    select count(distinct(h3_cell_to_parent(cell, {speedy_resolution}))) as cells from read_parquet('{file_path}')
    where AphiaID = {observation$taxonID}
  ")
  cells <- dbGetQuery(con, query)
  return(as.list(cells))
}

#' @export
evaluate_identity <- function(observation, intercept, slope, ...) {
  if (!is.na(observation$pident)) {
    p <- plogis(intercept + slope * observation$pident)
  } else {
    p <- NA
  }
  return(list(identity = p))
}

#' @export
evaluate_refdb <- function(observation, ...) {
  refdb_names_path <- getOption("ednaqc.refdb_names_path")
  con <- dbConnect(duckdb())
  query <- glue("
    select count(*) > 0 as present from read_parquet('{refdb_names_path}')
    where taxonID = {observation$taxonID}
  ")
  res <- dbGetQuery(con, query)
  return(list(refdb = res$present))
}

#' @export
evaluate <- function(observation, plugins, ...) {
  results <- observation
  for (plugin in plugins) {
    results <- c(results, plugin(observation, ...))
  }
  results
}
