devtools::load_all()

options(ednaqc.speedy_path = "/Volumes/acasis/speedy_output/edna_qc/parquet")
options(ednaqc.speciesgrids_path = "/Volumes/acasis/speciesgrids/h3_7")
options(ednaqc.speedy_resolution = 3)

my_observation <- list(taxonID = 141433, decimalLongitude = 2, decimalLatitude = 53)
evaluate(my_observation, plugins = list(evaluate_speedy, evaluate_speciesgrids))
