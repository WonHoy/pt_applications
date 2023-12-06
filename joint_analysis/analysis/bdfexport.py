def long_format(param_list: list) ->str:
    param_str = param_list[0]+'*'
    result_str = f'{param_str:<8}'
    param_list = param_list[1:]
    while len(param_list) >= 4:
        four_params = param_list[0:4]
        for i in range(4):
            str_to_add = f'{str(four_params[i]):16}'
            result_str = result_str + str_to_add
        if len(param_list) > 4:
            result_str = result_str + '\n' + '*       '
        if len(param_list) == 4:
            pass
        param_list = param_list[4:]
    for i in range(len(param_list)):
        str_to_add = f'{str(param_list[i]):16}'
        result_str = result_str + str_to_add
    return result_str

def short_format(param_list: list) ->str:
    result_str = ''
    for item in param_list:
        str_to_add = f'{str(item):8}'
        # print('short len=', len(str_to_add), str_to_add)
        if len(str(item)) >= 8:
            return long_format(param_list)
        result_str = result_str + str_to_add
    return result_str

def define_grid(id, x, y, z):
    x = round(x + 0.0, 6)
    y = round(y + 0.0, 6)
    z = round(z + 0.0, 6)
    coord_sys_id = ''
    param_list = ['GRID', id, coord_sys_id, x, y, z]
    result_str = short_format(param_list)
    return  result_str

def define_celas2(elm_id, stiffness, grid_point1, component1, grid_point2, component2):
    damping_coefficient = 0.0
    stress_coefficient = 0.0
    stiffness = round(stiffness + 0.0, 4)
    param_list = ['CELAS2', elm_id, stiffness, grid_point1, component1, grid_point2, component2,
                  damping_coefficient, stress_coefficient]
    result_str = short_format(param_list)
    print(f'define_celas2({elm_id},{stiffness},{grid_point1},{component1},{grid_point2},{component2})')
    return result_str

def define_spc_fixed_constraints(spc_id, grid_points: list, component_numbers: int):
    param_list = ['SPC1', spc_id, component_numbers]
    print('param_list', param_list)
    print(grid_points)
    param_list.extend(grid_points)
    print('param_list', param_list)
    result_str = short_format(param_list)
    return result_str

def define_force(force_id, grid_point_id: int, force_factor: int):
    coord_system_id = 0
    force_factor = round(force_factor + 0.0, 4)
    param_list = ['FORCE', force_id, grid_point_id, coord_system_id, force_factor, 1.0, 0.0, 0.0]
    return short_format(param_list)

def define_load_set(load_set_id, forces_ids: list):
    overall_scale_factor = 1.0
    param_list = ['LOAD', load_set_id, overall_scale_factor]
    for force_id in forces_ids:
        force_scale_factor = 1.0
        param_list.extend([force_scale_factor, force_id])
    return short_format(param_list)

def define_material(material_id, E, G = None):
    E = round(E + 0.0, 3)
    if G != None:
        G = round(G + 0.0, 3)
        param_list = ['MAT1', material_id, E, G]
    else:
        param_list = ['MAT1', material_id, E]
    return short_format(param_list)

def define_pbeam(property_id, material_id, area1, area2):
    I1 = 1.0  # Area moment of inertia at end A for bending in plane 1
    I2 = 1.0  # Area moment of inertia at end A for bending in plane 2
    X_over_element_length = 1.0  # end B location for cross-section area2
    stress_output_at_B = 'YES'
    shear_stiffness_K1 = 0.0
    shear_stiffness_K2 = 0.0
    area1 = round(area1 + 0.0, 8)
    area2 = round(area2 + 0.0, 8)

    param_list = ['PBEAM', property_id, material_id, area1 + 0.0, I1, I2]
    param_str1 = short_format(param_list) + '\n+\n'
    param_list = ['', stress_output_at_B, X_over_element_length, area2 + 0.0, I1, I2]
    param_str2 = short_format(param_list) + '\n+\n'
    param_list = ['', shear_stiffness_K1, shear_stiffness_K2]
    param_str3 = short_format(param_list)
    return param_str1 + param_str2 + param_str3

def define_cbeam(elm_id, property_id, grid_point1, grid_point2):
    orientation_x = 0.0
    orientation_y = 0.0
    orientation_z = 1.0
    param_list = ['CBEAM', elm_id, property_id, grid_point1, grid_point2, orientation_x, orientation_y, orientation_z]
    return short_format(param_list)

# s = []
# s.append(define_grid(1, 0.0, 0.0, 0.0))
# s.append(define_grid(2, 1.0, 0.0, 0.0))
# s.append(define_celas2(1,1400049.0, 1,1,2,1))
# for item in s:
#     print(item)
#
# print(s)