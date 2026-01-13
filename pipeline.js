const pipeline = [
  // 1) Only keep devices that contain "Global" in the Model field
  { 
    $match: { Model: /Global/i } 
  },

  // 2) Group all variants of the same device together
  //    - Group key is codename
  //    - If codename is null, fall back to _id
  {
    $group: {
      _id: {
        codename: "$codename",
        realId: {
          $cond: [
            { $eq: ["$codename", null] },
            "$_id",
            null
          ]
        }
      },
      // Keep the full original documents
      variants: { $push: "$$ROOT" }
    }
  },

  // 3) Clean group output
  //    - Remove internal _id
  //    - Keep codename and variants array
  {
    $project: {
      _id: 0,
      codename: "$_id.codename",
      variants: 1
    }
  },

  // 4) Build a merged "specs" object from all variants
  //    - Collect all possible field names
  //    - For each field:
  //        * If values differ across variants → keep array
  //        * If same → keep single value
  {
    $project: {
      // Use first variant _id as main _id
      _id: { $arrayElemAt: ["$variants._id", 0] },

      // Use first image found
      image: { $arrayElemAt: ["$variants.image", 0] },

      specs: {
        $let: {
          vars: {
            allVariants: { $ifNull: ["$variants", []] }
          },
          in: {
            $arrayToObject: {
              $map: {
                // Get all unique field names from all variants
                input: {
                  $filter: {
                    input: {
                      $reduce: {
                        input: "$$allVariants",
                        initialValue: [],
                        in: {
                          $setUnion: [
                            "$$value",
                            {
                              $map: {
                                input: { $objectToArray: "$$this" },
                                as: "f",
                                in: "$$f.k"
                              }
                            }
                          ]
                        }
                      }
                    },
                    as: "key",
                    // Exclude unwanted fields
                    cond: {
                      $not: {
                        $in: ["$$key", ["_id", "image", "__v"]]
                      }
                    }
                  }
                },
                as: "key",
                in: {
                  k: "$$key",
                  v: {
                    // Collect values for this key from all variants
                    $let: {
                      vars: {
                        values: {
                          $map: {
                            input: "$$allVariants",
                            as: "v",
                            in: {
                              $ifNull: [
                                { $getField: { field: "$$key", input: "$$v" } },
                                null
                              ]
                            }
                          }
                        }
                      },
                      in: {
                        // If more than one unique value → keep array
                        // Else → keep single value
                        $cond: [
                          { $gt: [{ $size: { $setUnion: "$$values" } }, 1] },
                          "$$values",
                          { $arrayElemAt: ["$$values", 0] }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  // 5) Build devicename = Brand + Model
  //    - Works whether Brand/Model are string or array
  {
    $set: {
      devicename: {
        $concat: [
          {
            $let: {
              vars: {
                brandArray: {
                  $cond: [
                    { $isArray: "$specs.Brand" },
                    "$specs.Brand",
                    ["$specs.Brand"]
                  ]
                }
              },
              in: { $ifNull: [{ $arrayElemAt: ["$$brandArray", 0] }, ""] }
            }
          },
          " ",
          {
            $let: {
              vars: {
                modelArray: {
                  $cond: [
                    { $isArray: "$specs.Model" },
                    "$specs.Model",
                    ["$specs.Model"]
                  ]
                }
              },
              in: { $ifNull: [{ $arrayElemAt: ["$$modelArray", 0] }, ""] }
            }
          }
        ]
      }
    }
  },

  // 6) Remove edition labels from device name
  {
    $set: {
      devicename: {
        $replaceAll: {
          input: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: "$devicename",
                  find: "Premium Edition",
                  replacement: ""
                }
              },
              find: "Standard Edition",
              replacement: ""
            }
          },
          find: "Top Edition",
          replacement: ""
        }
      }
    }
  },

  // 7) Remove anything after the word "Global"
  {
    $set: {
      devicename: {
        $trim: {
          input: {
            $arrayElemAt: [
              { $split: ["$devicename", "Global"] },
              0
            ]
          }
        }
      }
    }
  },

  // 8) Pick first deviceId from specs
  //    - If array → take first
  //    - If single value → wrap then take first
  {
    $set: {
      deviceid: {
        $arrayElemAt: [
          {
            $cond: [
              { $isArray: "$specs.deviceId" },
              "$specs.deviceId",
              ["$specs.deviceId"]
            ]
          },
          0
        ]
      }
    }
  }
];

module.exports = pipeline;
